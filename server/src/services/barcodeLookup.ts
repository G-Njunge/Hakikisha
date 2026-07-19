import pool from "../db/pool";

export interface MedicineRow {
  id: string;
  name: string;
  generic_name: string | null;
  manufacturer: string;
  dosage_form: string | null;
  strength: string | null;
  barcode: string;
  regulatory_body: string;
  approval_number: string;
  approval_status: string;
  created_at: string;
  updated_at: string;
}

interface BatchRow {
  batch_number: string;
  expiry_date: string;
  status: string;
}

export function toMedicineResponse(row: MedicineRow) {
  return {
    id: row.id,
    name: row.name,
    genericName: row.generic_name,
    manufacturer: row.manufacturer,
    dosageForm: row.dosage_form,
    strength: row.strength,
    barcode: row.barcode,
    regulatoryBody: row.regulatory_body,
    approvalNumber: row.approval_number,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ScanResultCode = "authentic" | "expired" | "unknown";

export type BarcodeLookupResult =
  | { found: false }
  | {
      found: true;
      scanResult: ScanResultCode;
      medicine: MedicineRow;
      batchNumber: string | null;
      expiryDate: string | null;
    };

interface LookupOptions {
  latitude: number | null;
  longitude: number | null;
  scannedBy: string | null;
}

// Shared by GET /api/medicines/barcode/:barcode and POST /api/scans: looks a
// barcode up against medicines + its latest batch, and logs the attempt to
// `scans` regardless of outcome (scanned_by is nullable — scanning doesn't
// require login).
export async function lookupBarcode(barcode: string, options: LookupOptions): Promise<BarcodeLookupResult> {
  const { latitude, longitude, scannedBy } = options;

  const { rows } = await pool.query<MedicineRow & BatchRow & { batch_id: string | null }>(
    `SELECT m.*, br.id AS batch_id, br.batch_number, br.expiry_date, br.status
     FROM medicines m
     LEFT JOIN batch_records br ON br.medicine_id = m.id
     WHERE m.barcode = $1
     ORDER BY br.expiry_date DESC NULLS LAST
     LIMIT 1`,
    [barcode]
  );

  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO scans (batch_record_id, scanned_by, result, latitude, longitude)
       VALUES (NULL, $1, 'unknown', $2, $3)`,
      [scannedBy, latitude, longitude]
    );

    return { found: false };
  }

  const row = rows[0];
  const isExpired = row.expiry_date !== null && new Date(row.expiry_date) < new Date();
  const scanResult: ScanResultCode = isExpired ? "expired" : row.approval_status === "approved" ? "authentic" : "unknown";

  await pool.query(
    `INSERT INTO scans (batch_record_id, scanned_by, result, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5)`,
    [row.batch_id, scannedBy, scanResult, latitude, longitude]
  );

  return {
    found: true,
    scanResult,
    medicine: row,
    batchNumber: row.batch_number ?? null,
    expiryDate: row.expiry_date ?? null,
  };
}
