import { Router } from "express";
import pool from "../db/pool";
import authenticate, { requireAdmin } from "../middleware/auth";
import { sendReportAlertEmail } from "../lib/email";

const router = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ~6M chars of base64 (~4.5MB raw image), comfortably under the JSON body limit.
const MAX_PHOTO_LENGTH = 6_000_000;
const PAGE_SIZE = 20;

const REPORT_ACTIONS = ["approve", "dismiss"] as const;
type ReportAction = (typeof REPORT_ACTIONS)[number];

function isReportAction(value: unknown): value is ReportAction {
  return typeof value === "string" && (REPORT_ACTIONS as readonly string[]).includes(value);
}

function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

interface ReportRow {
  id: string;
  scan_id: string | null;
  reported_by: string | null;
  product_name: string | null;
  description: string;
  country: string | null;
  purchase_location: string | null;
  photo_url: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportAdminRow extends ReportRow {
  reporter_email: string | null;
  reporter_full_name: string | null;
  scan_medicine_name: string | null;
}

function toReportDetail(row: ReportRow) {
  return {
    id: row.id,
    scanId: row.scan_id,
    productName: row.product_name,
    description: row.description,
    country: row.country,
    purchaseLocation: row.purchase_location,
    photoUrl: row.photo_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

// Omits the (potentially multi-MB base64) photoUrl in favor of a boolean —
// a list endpoint shouldn't have to ship every submitted photo in full.
function toReportSummary(row: ReportRow) {
  return {
    id: row.id,
    scanId: row.scan_id,
    productName: row.product_name,
    description: row.description,
    country: row.country,
    purchaseLocation: row.purchase_location,
    hasPhoto: row.photo_url !== null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

// Includes reporter identity and (for scan-linked reports, where product_name
// is null) the medicine name resolved via the scan — an admin can't sensibly
// approve/dismiss a report without knowing who filed it and what it's about.
// Photo is included in full here (unlike toReportSummary) since reviewing the
// attached evidence is the point of this view; pagination bounds payload size.
function toReportAdminResponse(row: ReportAdminRow) {
  return {
    id: row.id,
    scanId: row.scan_id,
    productName: row.product_name,
    medicineName: row.scan_medicine_name,
    description: row.description,
    country: row.country,
    purchaseLocation: row.purchase_location,
    photoUrl: row.photo_url,
    status: row.status,
    reporter: row.reported_by
      ? { id: row.reported_by, email: row.reporter_email, fullName: row.reporter_full_name }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

router.post("/", authenticate, async (req, res) => {
  const { scanId, productName, description, country, purchaseLocation, photoUrl } = req.body ?? {};

  if (typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  if (typeof country !== "string" || country.trim().length === 0) {
    res.status(400).json({ error: "country is required" });
    return;
  }

  const hasScanId = typeof scanId === "string" && scanId.length > 0;
  const hasProductName = typeof productName === "string" && productName.trim().length > 0;

  if (!hasScanId && !hasProductName) {
    res.status(400).json({ error: "Provide either scanId or productName" });
    return;
  }

  if (hasScanId && !UUID_PATTERN.test(scanId)) {
    res.status(400).json({ error: "scanId must be a valid UUID" });
    return;
  }

  if (purchaseLocation !== undefined && typeof purchaseLocation !== "string") {
    res.status(400).json({ error: "purchaseLocation must be a string" });
    return;
  }

  if (photoUrl !== undefined && photoUrl !== null) {
    if (typeof photoUrl !== "string") {
      res.status(400).json({ error: "photoUrl must be a string" });
      return;
    }
    if (photoUrl.length > MAX_PHOTO_LENGTH) {
      res.status(400).json({ error: "photoUrl is too large" });
      return;
    }
  }

  const normalizedCountry = country.trim();

  let row: ReportRow;
  try {
    const { rows } = await pool.query<ReportRow>(
      `INSERT INTO reports (scan_id, reported_by, product_name, description, country, purchase_location, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        hasScanId ? scanId : null,
        req.user?.sub ?? null,
        hasProductName ? productName.trim() : null,
        description.trim(),
        normalizedCountry,
        purchaseLocation?.trim() || null,
        photoUrl ?? null,
      ]
    );
    row = rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      res.status(400).json({ error: "scanId does not reference an existing scan" });
      return;
    }
    throw err;
  }

  res.status(201).json({ report: toReportDetail(row) });

  // Alerting the health authority is best-effort — it must never affect the
  // response the reporter already received above, so failures (no HA on file
  // for this country, Resend rejecting the send, etc.) are only logged.
  try {
    const { rows: haRows } = await pool.query<{ email: string }>(
      "SELECT email FROM health_authorities WHERE country = $1",
      [normalizedCountry]
    );

    if (haRows.length === 0) {
      console.warn(`No health authority on file for country "${normalizedCountry}" — report ${row.id} not alerted`);
      return;
    }

    await sendReportAlertEmail(haRows[0].email, {
      productName: row.product_name ?? "Unknown product",
      country: normalizedCountry,
      description: row.description,
      dateFiled: new Date(row.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
  } catch (err) {
    console.error(`Failed to send report alert email for report ${row.id}`, err);
  }
});

router.get("/my", authenticate, async (req, res) => {
  const { rows } = await pool.query<ReportRow>(
    "SELECT * FROM reports WHERE reported_by = $1 ORDER BY created_at DESC",
    [req.user?.sub]
  );

  res.status(200).json({ reports: rows.map(toReportSummary) });
});

router.get("/", authenticate, requireAdmin, async (req, res) => {
  const currentPage = parsePage(req.query.page);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [{ rows }, countResult] = await Promise.all([
    pool.query<ReportAdminRow>(
      `SELECT r.*, u.email AS reporter_email, u.full_name AS reporter_full_name, m.name AS scan_medicine_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.reported_by
       LEFT JOIN scans s ON s.id = r.scan_id
       LEFT JOIN batch_records br ON br.id = s.batch_record_id
       LEFT JOIN medicines m ON m.id = br.medicine_id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    ),
    pool.query<{ count: string }>("SELECT count(*) FROM reports"),
  ]);

  const totalCount = Number(countResult.rows[0].count);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  res.status(200).json({
    reports: rows.map(toReportAdminResponse),
    pagination: { page: currentPage, pageSize: PAGE_SIZE, totalCount, totalPages },
  });
});

router.patch("/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body ?? {};

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }

  if (!isReportAction(action)) {
    res.status(400).json({ error: "action must be 'approve' or 'dismiss'" });
    return;
  }

  const newStatus = action === "approve" ? "resolved" : "dismissed";

  const { rows } = await pool.query<ReportRow>(
    `UPDATE reports
     SET status = $1, resolved_by = $2, resolved_at = now(), updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [newStatus, req.user?.sub ?? null, id]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.status(200).json({ report: toReportDetail(rows[0]) });
});

export default router;
