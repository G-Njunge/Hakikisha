// Applies every schema change made after the original schema.sql was first
// deployed (Railway, or any other environment that predates this session's
// features). Safe to run repeatedly and against a database that already has
// some, none, or all of these changes — every statement either uses
// IF NOT EXISTS or swallows the specific "already exists" error code.
//
// For a brand-new, completely empty database, just run schema.sql instead
// (it already creates everything from scratch) followed by seed.ts.
//
// Usage:
//   DATABASE_URL=<railway-connection-string> npx ts-node src/db/migrate.ts

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ALREADY_EXISTS = "42710"; // duplicate_object (type, constraint, ...)

async function run(label: string, sql: string) {
  try {
    await pool.query(sql);
    console.log(`OK    ${label}`);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === ALREADY_EXISTS) {
      console.log(`SKIP  ${label} (already exists)`);
      return;
    }
    console.error(`FAIL  ${label}`);
    throw err;
  }
}

async function main() {
  // --- medicine_photos (front/back reference images) ---
  await run(
    "CREATE TYPE photo_angle",
    `CREATE TYPE photo_angle AS ENUM ('front', 'back')`
  );
  await run(
    "CREATE TABLE medicine_photos",
    `CREATE TABLE IF NOT EXISTS medicine_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        angle photo_angle NOT NULL,
        image_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (medicine_id, angle)
    )`
  );
  await run(
    "CREATE INDEX idx_medicine_photos_medicine_id",
    `CREATE INDEX IF NOT EXISTS idx_medicine_photos_medicine_id ON medicine_photos(medicine_id)`
  );

  // --- verification_checklist_items (package verification + safety comparison) ---
  await run(
    "CREATE TYPE checklist_section",
    `CREATE TYPE checklist_section AS ENUM ('package_verification', 'safety_comparison')`
  );
  await run(
    "CREATE TABLE verification_checklist_items",
    `CREATE TABLE IF NOT EXISTS verification_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        section checklist_section NOT NULL,
        label VARCHAR(255) NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (medicine_id, section, label)
    )`
  );
  await run(
    "CREATE INDEX idx_verification_checklist_items_medicine_id",
    `CREATE INDEX IF NOT EXISTS idx_verification_checklist_items_medicine_id
       ON verification_checklist_items(medicine_id, section, display_order)`
  );

  // --- pharmacies (nearby-pharmacy step) ---
  await run(
    "CREATE TABLE pharmacies",
    `CREATE TABLE IF NOT EXISTS pharmacies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (name, address)
    )`
  );

  // --- reports: product_name / purchase_location / photo_url ---
  await run(
    "ALTER TABLE reports ADD COLUMN product_name",
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)`
  );
  await run(
    "ALTER TABLE reports ADD COLUMN purchase_location",
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS purchase_location VARCHAR(255)`
  );
  await run(
    "ALTER TABLE reports ADD COLUMN photo_url",
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_url TEXT`
  );
  await run(
    "ALTER TABLE reports ADD CONSTRAINT reports_scan_or_product_check",
    `ALTER TABLE reports ADD CONSTRAINT reports_scan_or_product_check
       CHECK (scan_id IS NOT NULL OR product_name IS NOT NULL)`
  );
  await run(
    "CREATE INDEX idx_reports_reported_by",
    `CREATE INDEX IF NOT EXISTS idx_reports_reported_by ON reports(reported_by)`
  );

  // --- scans: barcode (+ backfill from matched medicines where possible) ---
  await run(
    "ALTER TABLE scans ADD COLUMN barcode",
    `ALTER TABLE scans ADD COLUMN IF NOT EXISTS barcode VARCHAR(13)`
  );
  const backfill = await pool.query(`
    UPDATE scans s
    SET barcode = m.barcode
    FROM batch_records br
    JOIN medicines m ON m.id = br.medicine_id
    WHERE br.id = s.batch_record_id AND s.barcode IS NULL
  `);
  console.log(`OK    backfill scans.barcode from matched medicines (${backfill.rowCount} rows)`);

  // --- reports: country (routes the report-alert email) ---
  await run(
    "ALTER TABLE reports ADD COLUMN country",
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS country VARCHAR(100)`
  );

  // --- health_authorities (one row per country, keyed by country) ---
  await run(
    "CREATE TABLE health_authorities",
    `CREATE TABLE IF NOT EXISTS health_authorities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        country VARCHAR(100) NOT NULL UNIQUE,
        authority_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );

  // --- medicines.barcode: widen 13-digit-only check to 8-13 digits ---
  // (lets a scanned/uploaded QR code that decodes to fewer than 13 digits be
  // stored as-is, matching the API's own /^\d{8,13}$/ validation). This is a
  // replace, not a guarded create, so it's done directly rather than via
  // run() — drop-if-present then re-add always leaves the widened version.
  await pool.query(`ALTER TABLE medicines DROP CONSTRAINT IF EXISTS medicines_barcode_check`);
  await pool.query(`ALTER TABLE medicines ADD CONSTRAINT medicines_barcode_check CHECK (barcode ~ '^[0-9]{8,13}$')`);
  console.log("OK    ALTER TABLE medicines: widened medicines_barcode_check to 8-13 digits");

  console.log("\nMigration complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
