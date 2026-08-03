import { Router } from "express";
import pool from "../db/pool";
import authenticate, { requireAdmin } from "../middleware/auth";
import { sendReportAlertEmail } from "../lib/email";

const router = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ~6M chars of base64 (~4.5MB raw image), comfortably under the JSON body limit.
const MAX_PHOTO_LENGTH = 6_000_000;
const PAGE_SIZE = 20;

const REPORT_ACTIONS = ["approve", "dismiss", "review", "escalate"] as const;
type ReportAction = (typeof REPORT_ACTIONS)[number];

// review/escalate are non-terminal — a report can still move on from them,
// so they update `status` only. approve/dismiss are terminal and additionally
// stamp resolved_by/resolved_at, which should mean "when this was actually
// concluded," not "last touched."
const ACTION_TO_STATUS: Record<ReportAction, string> = {
  approve: "resolved",
  dismiss: "dismissed",
  review: "investigating",
  escalate: "escalated",
};
const TERMINAL_ACTIONS = new Set<ReportAction>(["approve", "dismiss"]);

function isReportAction(value: unknown): value is ReportAction {
  return typeof value === "string" && (REPORT_ACTIONS as readonly string[]).includes(value);
}

const REPORT_STATUSES = ["pending", "investigating", "resolved", "dismissed", "escalated"] as const;
type ReportStatusValue = (typeof REPORT_STATUSES)[number];

function isReportStatus(value: unknown): value is ReportStatusValue {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
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
  admin_notes: string | null;
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
    adminNotes: row.admin_notes,
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

router.get("/unread-count", authenticate, requireAdmin, async (req, res) => {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM reports r
     WHERE r.created_at > COALESCE(
       (SELECT reports_last_viewed_at FROM users WHERE id = $1),
       '-infinity'
     )`,
    [req.user?.sub]
  );

  res.status(200).json({ count: Number(rows[0].count) });
});

router.get("/", authenticate, requireAdmin, async (req, res) => {
  const currentPage = parsePage(req.query.page);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const statusFilter = isReportStatus(req.query.status) ? req.query.status : null;
  const sortDirection = req.query.sort === "oldest" ? "ASC" : "DESC";

  const whereClause = statusFilter ? "WHERE r.status = $3" : "";
  const listParams = statusFilter ? [PAGE_SIZE, offset, statusFilter] : [PAGE_SIZE, offset];

  const [{ rows }, countResult] = await Promise.all([
    pool.query<ReportAdminRow>(
      `SELECT r.*, u.email AS reporter_email, u.full_name AS reporter_full_name, m.name AS scan_medicine_name
       FROM reports r
       LEFT JOIN users u ON u.id = r.reported_by
       LEFT JOIN scans s ON s.id = r.scan_id
       LEFT JOIN batch_records br ON br.id = s.batch_record_id
       LEFT JOIN medicines m ON m.id = br.medicine_id
       ${whereClause}
       ORDER BY r.created_at ${sortDirection}
       LIMIT $1 OFFSET $2`,
      listParams
    ),
    pool.query<{ count: string }>(
      `SELECT count(*) FROM reports ${statusFilter ? "WHERE status = $1" : ""}`,
      statusFilter ? [statusFilter] : []
    ),
    // Opening the admin reports table is what "marks it read" — best-effort,
    // never blocks the response the admin is waiting on.
    pool.query("UPDATE users SET reports_last_viewed_at = now() WHERE id = $1", [req.user?.sub]).catch((err) => {
      console.error("Failed to update reports_last_viewed_at", err);
    }),
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
  const { action, notes } = req.body ?? {};

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }

  const hasAction = action !== undefined;
  const hasNotes = notes !== undefined;

  if (!hasAction && !hasNotes) {
    res.status(400).json({ error: "Provide action and/or notes" });
    return;
  }

  if (hasAction && !isReportAction(action)) {
    res.status(400).json({ error: `action must be one of: ${REPORT_ACTIONS.join(", ")}` });
    return;
  }

  if (hasNotes && typeof notes !== "string") {
    res.status(400).json({ error: "notes must be a string" });
    return;
  }

  const setClauses = ["updated_at = now()"];
  const params: unknown[] = [];

  if (hasAction) {
    params.push(ACTION_TO_STATUS[action as ReportAction]);
    setClauses.push(`status = $${params.length}`);

    if (TERMINAL_ACTIONS.has(action as ReportAction)) {
      params.push(req.user?.sub ?? null);
      setClauses.push(`resolved_by = $${params.length}`, "resolved_at = now()");
    }
  }

  if (hasNotes) {
    params.push(notes);
    setClauses.push(`admin_notes = $${params.length}`);
  }

  params.push(id);
  const idParamIndex = params.length;

  const { rows } = await pool.query<{ id: string }>(
    `UPDATE reports SET ${setClauses.join(", ")} WHERE id = $${idParamIndex} RETURNING id`,
    params
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  // Re-fetched with the same joins as the admin list endpoint (rather than
  // trusting UPDATE...RETURNING *, which only has the reports table's own
  // columns) so the response includes reporter identity + medicine name —
  // the admin UI updates its local row from this response without a refetch.
  const { rows: adminRows } = await pool.query<ReportAdminRow>(
    `SELECT r.*, u.email AS reporter_email, u.full_name AS reporter_full_name, m.name AS scan_medicine_name
     FROM reports r
     LEFT JOIN users u ON u.id = r.reported_by
     LEFT JOIN scans s ON s.id = r.scan_id
     LEFT JOIN batch_records br ON br.id = s.batch_record_id
     LEFT JOIN medicines m ON m.id = br.medicine_id
     WHERE r.id = $1`,
    [rows[0].id]
  );

  res.status(200).json({ report: toReportAdminResponse(adminRows[0]) });
});

export default router;
