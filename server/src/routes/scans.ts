import { Router } from "express";
import pool from "../db/pool";
import authenticate, { optionalAuthenticate } from "../middleware/auth";
import { lookupBarcode } from "../services/barcodeLookup";

const router = Router();

interface ScanHistoryRow {
  id: string;
  barcode: string | null;
  result: string;
  scanned_at: string;
  medicine_name: string | null;
}

function parseCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

router.post("/", optionalAuthenticate, async (req, res) => {
  const { barcode, lat, lng } = req.body ?? {};

  if (typeof barcode !== "string" || !/^\d{8,13}$/.test(barcode)) {
    res.status(400).json({ error: "barcode must be an 8-13 digit numeric string" });
    return;
  }

  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);

  const result = await lookupBarcode(barcode, { latitude, longitude, scannedBy: req.user?.sub ?? null });

  if (!result.found) {
    res.status(200).json({
      status: "UNVERIFIED",
      scanId: result.scanId,
      medicine: null,
      batchNumber: null,
      message: "This barcode does not exist in the Hakikisha database.",
    });
    return;
  }

  const isVerified = result.scanResult === "authentic";

  res.status(200).json({
    status: isVerified ? "VERIFIED" : "UNVERIFIED",
    scanId: result.scanId,
    medicine: {
      id: result.medicine.id,
      name: result.medicine.name,
      manufacturer: result.medicine.manufacturer,
      approvalStatus: result.medicine.approval_status,
    },
    batchNumber: result.batchNumber,
    message: isVerified
      ? undefined
      : result.scanResult === "expired"
        ? "This batch has expired."
        : "This medicine is registered but not yet approved.",
  });
});

router.get("/my", authenticate, async (req, res) => {
  const { rows } = await pool.query<ScanHistoryRow>(
    `SELECT s.id, s.barcode, s.result, s.scanned_at, m.name AS medicine_name
     FROM scans s
     LEFT JOIN batch_records br ON br.id = s.batch_record_id
     LEFT JOIN medicines m ON m.id = br.medicine_id
     WHERE s.scanned_by = $1
     ORDER BY s.scanned_at DESC`,
    [req.user?.sub]
  );

  res.status(200).json({
    scans: rows.map((row) => ({
      id: row.id,
      barcode: row.barcode,
      medicineName: row.medicine_name,
      result: row.result,
      scannedAt: row.scanned_at,
    })),
  });
});

export default router;
