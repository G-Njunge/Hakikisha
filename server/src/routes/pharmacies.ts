import { Router } from "express";
import pool from "../db/pool";

const router = Router();

const DEFAULT_RADIUS_KM = 10;
const EARTH_RADIUS_KM = 6371;

interface PharmacyRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  distance_km: number;
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

  if (lat === null || lng === null) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  // Haversine distance computed in-query; fine at this table size without PostGIS.
  const { rows } = await pool.query<PharmacyRow>(
    `SELECT *, distance_km FROM (
       SELECT
         id, name, address, latitude, longitude, phone,
         $3 * 2 * asin(sqrt(
           power(sin(radians(($1 - latitude) / 2)), 2) +
           cos(radians($1)) * cos(radians(latitude)) *
           power(sin(radians(($2 - longitude) / 2)), 2)
         )) AS distance_km
       FROM pharmacies
     ) AS with_distance
     WHERE distance_km <= $4
     ORDER BY distance_km ASC
     LIMIT 20`,
    [lat, lng, EARTH_RADIUS_KM, radiusKm]
  );

  res.status(200).json({
    results: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      distanceKm: Math.round(row.distance_km * 10) / 10,
    })),
  });
});

export default router;
