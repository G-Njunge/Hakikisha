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
  medicine_id: string | null;
  medicine_name: string | null;
}

function parseCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// scans.result only distinguishes authentic/expired/unknown (a batch-level
// outcome, matching the stored enum) — but the medicine's own approval_status
// has four distinct values, and collapsing pending/rejected/expired-approval
// into one generic "not yet approved" message was actively misleading for two
// of those three cases. This branches on the real value instead.
function buildStatusMessage(isBatchExpired: boolean, approvalStatus: string): string | undefined {
  if (isBatchExpired) {
    return "This batch has expired.";
  }
  switch (approvalStatus) {
    case "approved":
      return undefined;
    case "pending":
      return "This medicine is registered but awaiting regulatory approval.";
    case "rejected":
      return "This medicine's registration was rejected by the regulator — treat with caution.";
    case "expired":
      return "This medicine's regulatory approval has expired.";
    default:
      return "This medicine is registered but not yet approved.";
  }
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
    expiryDate: result.expiryDate,
    message: buildStatusMessage(result.scanResult === "expired", result.medicine.approval_status),
  });
});

router.get("/my", authenticate, async (req, res) => {
  // Joins on the scanned barcode (not batch_record_id) so history still
  // resolves the medicine when no batch record exists for it — batch_record_id
  // is only ever set when a matching batch happens to exist, which most
  // medicines in this dataset don't have.
  const { rows } = await pool.query<ScanHistoryRow>(
    `SELECT s.id, s.barcode, s.result, s.scanned_at, m.id AS medicine_id, m.name AS medicine_name
     FROM scans s
     LEFT JOIN medicines m ON m.barcode = s.barcode
     WHERE s.scanned_by = $1
     ORDER BY s.scanned_at DESC`,
    [req.user?.sub]
  );

  res.status(200).json({
    scans: rows.map((row) => ({
      id: row.id,
      barcode: row.barcode,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name,
      result: row.result,
      scannedAt: row.scanned_at,
    })),
  });
});

export default router;
