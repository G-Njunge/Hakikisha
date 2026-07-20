import { Router } from "express";
import pool from "../db/pool";
import { optionalAuthenticate } from "../middleware/auth";
import { lookupBarcode, toMedicineResponse } from "../services/barcodeLookup";
import type { MedicineRow } from "../services/barcodeLookup";

const router = Router();

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MedicinePhotoRow {
  angle: "front" | "back";
  image_url: string;
}

interface ChecklistItemRow {
  section: "package_verification" | "safety_comparison";
  label: string;
}

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

router.get("/search", async (req, res) => {
  const { q, page } = req.query;

  if (typeof q !== "string" || q.trim().length === 0) {
    res.status(400).json({ error: "q is required" });
    return;
  }

  const currentPage = parsePage(page);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const pattern = `%${q.trim()}%`;

  const [{ rows }, countResult] = await Promise.all([
    pool.query<MedicineRow>(
      `SELECT * FROM medicines
       WHERE name ILIKE $1 OR generic_name ILIKE $1
       ORDER BY name
       LIMIT $2 OFFSET $3`,
      [pattern, PAGE_SIZE, offset]
    ),
    pool.query<{ count: string }>(
      "SELECT count(*) FROM medicines WHERE name ILIKE $1 OR generic_name ILIKE $1",
      [pattern]
    ),
  ]);

  const totalCount = Number(countResult.rows[0].count);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  res.status(200).json({
    results: rows.map(toMedicineResponse),
    pagination: { page: currentPage, pageSize: PAGE_SIZE, totalCount, totalPages },
  });
});

function parseCoordinate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get("/barcode/:barcode", optionalAuthenticate, async (req, res) => {
  const { barcode } = req.params;
  const latitude = parseCoordinate(req.query.lat);
  const longitude = parseCoordinate(req.query.lng);

  if (typeof barcode !== "string" || !/^\d{8,13}$/.test(barcode)) {
    res.status(400).json({ error: "Barcode must be numeric" });
    return;
  }

  const result = await lookupBarcode(barcode, { latitude, longitude, scannedBy: req.user?.sub ?? null });

  if (!result.found) {
    res.status(200).json({
      found: false,
      scanId: result.scanId,
      message: "This barcode does not exist in the Hakikisha database.",
      verificationStatus: "Unknown",
    });
    return;
  }

  res.status(200).json({
    found: true,
    scanId: result.scanId,
    medicine: toMedicineResponse(result.medicine),
    batchNumber: result.batchNumber ?? "Not listed",
    expiryDate: result.expiryDate,
    registrationStatus: result.medicine.approval_status === "approved" ? "Registered" : result.medicine.approval_status,
    verificationStatus: result.medicine.approval_status === "approved" ? "Verified" : "Pending review",
  });
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "Invalid medicine id" });
    return;
  }

  const { rows } = await pool.query<MedicineRow>("SELECT * FROM medicines WHERE id = $1", [id]);

  if (rows.length === 0) {
    res.status(404).json({ error: "Medicine not found" });
    return;
  }

  res.status(200).json({ medicine: toMedicineResponse(rows[0]) });
});

router.get("/:id/verification", async (req, res) => {
  const { id } = req.params;

  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "Invalid medicine id" });
    return;
  }

  const [medicineResult, photosResult, checklistResult] = await Promise.all([
    pool.query<MedicineRow>("SELECT * FROM medicines WHERE id = $1", [id]),
    pool.query<MedicinePhotoRow>(
      "SELECT angle, image_url FROM medicine_photos WHERE medicine_id = $1",
      [id]
    ),
    pool.query<ChecklistItemRow>(
      `SELECT section, label FROM verification_checklist_items
       WHERE medicine_id = $1
       ORDER BY section, display_order`,
      [id]
    ),
  ]);

  if (medicineResult.rows.length === 0) {
    res.status(404).json({ error: "Medicine not found" });
    return;
  }

  const photos = photosResult.rows.reduce<{ front: string | null; back: string | null }>(
    (acc, row) => {
      acc[row.angle] = row.image_url;
      return acc;
    },
    { front: null, back: null }
  );

  const packageVerification = checklistResult.rows
    .filter((row) => row.section === "package_verification")
    .map((row) => row.label);
  const safetyComparison = checklistResult.rows
    .filter((row) => row.section === "safety_comparison")
    .map((row) => row.label);

  res.status(200).json({
    medicine: toMedicineResponse(medicineResult.rows[0]),
    photos,
    packageVerification,
    safetyComparison,
  });
});

export default router;
