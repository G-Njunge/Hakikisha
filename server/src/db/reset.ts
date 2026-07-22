// DESTRUCTIVE — drops every table/type in the public schema and rebuilds it
// from scratch using schema.sql. Only ever run this against a database you
// are fine wiping entirely (e.g. a Railway deployment with no real user data
// yet). Requires an explicit --yes flag so it can never run by accident.
//
// Usage:
//   DATABASE_URL=<connection-string> npx ts-node src/db/reset.ts --yes

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  let host = databaseUrl;
  try {
    host = new URL(databaseUrl).host;
  } catch {
    // fall back to printing the raw value if it's not a parseable URL
  }
  console.error(`This will DROP EVERYTHING in the database at "${host}" and rebuild it from schema.sql.`);
  console.error(`Re-run with --yes if that's really what you want:`);
  console.error(`  npx ts-node src/db/reset.ts --yes`);
  process.exit(1);
}

const isLocalDb = /localhost|127\.0\.0\.1/.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

async function main() {
  console.log("Dropping public schema...");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");

  console.log("Applying schema.sql...");
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schemaSql);

  console.log("\nSchema reset complete. Now run: npm run db:seed");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
