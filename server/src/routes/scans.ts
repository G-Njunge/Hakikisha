import { Router } from "express";
import { lookupBarcode } from "../services/barcodeLookup";

const router = Router();

function parseCoordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

router.post("/", async (req, res) => {
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
      medicine: null,
      batchNumber: null,
      message: "This barcode does not exist in the Hakikisha database.",
    });
    return;
  }

  const isVerified = result.scanResult === "authentic";

  res.status(200).json({
    status: isVerified ? "VERIFIED" : "UNVERIFIED",
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

export default router;
