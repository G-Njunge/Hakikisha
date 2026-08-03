import { Router } from "express";
import pool from "../db/pool";
import authenticate, { requireAdmin } from "../middleware/auth";
import { toReportAdminResponse } from "./reports";
import type { ReportAdminRow } from "./reports";

const router = Router();

const USER_ROLES = ["admin", "manufacturer", "pharmacist", "consumer"] as const;
const SCAN_RESULTS = ["authentic", "expired", "unknown"] as const;
const REPORT_STATUSES = ["pending", "investigating", "escalated", "resolved", "dismissed"] as const;

function zeroFilledCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, n) => total + n, 0);
}

// Every day in the trailing 7-day window (including today, oldest first),
// pre-filled with 0 — the scans query below only returns rows for days that
// actually had at least one scan, so this fills the gaps rather than letting
// the client-side chart silently skip quiet days.
function last7DayKeys(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Admin-only "what's been going on" overview — one endpoint backing the
// Dashboard's Overview tab for admins, rather than the client making many
// separate requests for counts it could otherwise get in one round trip.
router.get("/stats", authenticate, requireAdmin, async (req, res) => {
  const [
    userRoleRows,
    medicineCountRows,
    pharmacyCountRows,
    scanResultRows,
    scanTrendRows,
    reportStatusRows,
    topMedicineRows,
    recentReportRows,
  ] = await Promise.all([
    pool.query<{ role: string; count: string }>("SELECT role, count(*) FROM users GROUP BY role"),
    pool.query<{ count: string }>("SELECT count(*) FROM medicines"),
    pool.query<{ count: string }>("SELECT count(*) FROM pharmacies"),
    pool.query<{ result: string; count: string }>("SELECT result, count(*) FROM scans GROUP BY result"),
    pool.query<{ day: string; count: string }>(
      `SELECT to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') AS day, count(*)
       FROM scans
       WHERE scanned_at > now() - interval '7 days'
       GROUP BY 1
       ORDER BY 1`
    ),
    pool.query<{ status: string; count: string }>("SELECT status, count(*) FROM reports GROUP BY status"),
    pool.query<{ name: string; count: string }>(
      `SELECT m.name, count(*) AS count
       FROM scans s
       JOIN medicines m ON m.barcode = s.barcode
       GROUP BY m.name
       ORDER BY count DESC
       LIMIT 5`
    ),
    pool.query<ReportAdminRow>(
      `SELECT r.*, u.email AS reporter_email, u.full_name AS reporter_full_name, m.name AS scan_medicine_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.reported_by
       LEFT JOIN scans s ON s.id = r.scan_id
       LEFT JOIN batch_records br ON br.id = s.batch_record_id
       LEFT JOIN medicines m ON m.id = br.medicine_id
       ORDER BY r.created_at DESC
       LIMIT 5`
    ),
  ]);

  const usersByRole = zeroFilledCounts(USER_ROLES);
  for (const row of userRoleRows.rows) {
    if (row.role in usersByRole) usersByRole[row.role as (typeof USER_ROLES)[number]] = Number(row.count);
  }

  const scansByResult = zeroFilledCounts(SCAN_RESULTS);
  for (const row of scanResultRows.rows) {
    if (row.result in scansByResult) scansByResult[row.result as (typeof SCAN_RESULTS)[number]] = Number(row.count);
  }

  const reportsByStatus = zeroFilledCounts(REPORT_STATUSES);
  for (const row of reportStatusRows.rows) {
    if (row.status in reportsByStatus) reportsByStatus[row.status as (typeof REPORT_STATUSES)[number]] = Number(row.count);
  }

  const trendByDay = new Map(scanTrendRows.rows.map((row) => [row.day, Number(row.count)]));
  const scansLast7Days = last7DayKeys().map((date) => ({ date, count: trendByDay.get(date) ?? 0 }));

  res.status(200).json({
    totalUsers: sum(usersByRole),
    usersByRole,
    totalMedicines: Number(medicineCountRows.rows[0].count),
    totalPharmacies: Number(pharmacyCountRows.rows[0].count),
    totalScans: sum(scansByResult),
    scansByResult,
    scansLast7Days,
    totalReports: sum(reportsByStatus),
    reportsByStatus,
    topScannedMedicines: topMedicineRows.rows.map((row) => ({ name: row.name, count: Number(row.count) })),
    recentReports: recentReportRows.rows.map(toReportAdminResponse),
  });
});

export default router;
