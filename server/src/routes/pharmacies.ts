import { Router } from "express";
import pool from "../db/pool";
import { isOpenNow } from "../lib/pharmacyHours";

const router = Router();

const DEFAULT_RADIUS_KM = 10;
const EARTH_RADIUS_KM = 6371;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PharmacyRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  hours: string | null;
  distance_km: number;
  stocks_medicine: boolean | null;
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get("/nearby", async (req, res) => {
  const lat = parseCoordinate(req.query.lat);
  const lng = parseCoordinate(req.query.lng);
  const radiusKm = parseCoordinate(req.query.radiusKm) ?? DEFAULT_RADIUS_KM;
  const { medicineId } = req.query;
  const openNowOnly = req.query.openNow === "true";

  if (lat === null || lng === null) {
    res.status(400).json({ error: "We need your location to find nearby pharmacies." });
    return;
  }

  if (medicineId !== undefined && (typeof medicineId !== "string" || !UUID_PATTERN.test(medicineId))) {
    res.status(400).json({ error: "We couldn't find that medicine." });
    return;
  }

  // Haversine distance computed in-query; fine at this table size without
  // PostGIS. stocks_medicine is only meaningful when medicineId is passed —
  // it's a flag/sort key, not a hard filter, since our stock data is sparse
  // demo seed data and hiding every non-confirmed pharmacy would often leave
  // a "no pharmacies found" result even where real ones are nearby.
  const { rows } = await pool.query<PharmacyRow>(
    `SELECT *, distance_km FROM (
       SELECT
         p.id, p.name, p.address, p.latitude, p.longitude, p.phone, p.hours,
         $3 * 2 * asin(sqrt(
           power(sin(radians(($1 - p.latitude) / 2)), 2) +
           cos(radians($1)) * cos(radians(p.latitude)) *
           power(sin(radians(($2 - p.longitude) / 2)), 2)
         )) AS distance_km,
         CASE WHEN $5::uuid IS NULL THEN NULL
              ELSE EXISTS (
                SELECT 1 FROM pharmacy_medicine_stock pms
                WHERE pms.pharmacy_id = p.id AND pms.medicine_id = $5::uuid
              )
         END AS stocks_medicine
       FROM pharmacies p
     ) AS with_distance
     WHERE distance_km <= $4
     ORDER BY stocks_medicine DESC NULLS LAST, distance_km ASC
     LIMIT 100`,
    [lat, lng, EARTH_RADIUS_KM, radiusKm, medicineId ?? null]
  );

  // Computed here (rather than in SQL) since it's just string parsing —
  // always attached so the UI can show an open/closed tag even when the
  // openNow filter itself isn't active.
  let results = rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    hours: row.hours,
    distanceKm: Math.round(row.distance_km * 10) / 10,
    stocksMedicine: row.stocks_medicine,
    isOpenNow: isOpenNow(row.hours),
  }));

  if (openNowOnly) {
    results = results.filter((pharmacy) => pharmacy.isOpenNow === true);
  }

  res.status(200).json({ results });
});

export default router;
