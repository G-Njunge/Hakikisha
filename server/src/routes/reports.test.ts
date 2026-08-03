import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.JWT_SECRET ??= "test_secret_not_real";

const { mockQuery, mockSendReportAlertEmail } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSendReportAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db/pool", () => ({ default: { query: mockQuery } }));
vi.mock("../lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendReportAlertEmail: mockSendReportAlertEmail,
}));

import app from "../app";
import { signAccessToken } from "../lib/tokens";

const REPORT_ID = "11111111-1111-1111-1111-111111111111";
const SCAN_ID = "22222222-2222-2222-2222-222222222222";

const CSRF_TOKEN = "test-csrf-token";

// PATCH (mutating) requests need the double-submit CSRF cookie + matching
// header alongside the access-token cookie, or csrfProtection 403s them
// before route logic runs. GET requests (e.g. unread-count) don't need it.
function adminCookie(): string {
  const { token } = signAccessToken({ sub: "admin-1", role: "admin" });
  return `hakikisha_access_token=${token}; hakikisha_csrf_token=${CSRF_TOKEN}`;
}

function userCookie(): string {
  const { token } = signAccessToken({ sub: "user-1", role: "consumer" });
  return `hakikisha_access_token=${token}; hakikisha_csrf_token=${CSRF_TOKEN}`;
}

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    scan_id: null,
    reported_by: "user-1",
    product_name: "Panadol",
    description: "Looks fake",
    country: "Kenya",
    purchase_location: "CBD",
    photo_url: null,
    status: "pending",
    admin_notes: null,
    resolved_by: null,
    resolved_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockAdminReportRow(overrides: Record<string, unknown> = {}) {
  return {
    rows: [
      {
        id: REPORT_ID,
        scan_id: null,
        reported_by: "user-1",
        product_name: "Panadol",
        description: "Looks fake",
        country: "Kenya",
        purchase_location: "CBD",
        photo_url: null,
        status: "resolved",
        admin_notes: null,
        resolved_by: "admin-1",
        resolved_at: "2026-07-30T00:00:00.000Z",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-30T00:00:00.000Z",
        reporter_email: "reporter@example.com",
        reporter_full_name: "A Reporter",
        scan_medicine_name: null,
        ...overrides,
      },
    ],
  };
}

describe("PATCH /api/reports/:id", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a request with neither action nor notes", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({});

    expect(res.status).toBe(400);
    expect(mockQuery).toHaveBeenCalledTimes(1); // never reached the UPDATE
  });

  it("rejects an invalid action", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ action: "bogus" });

    expect(res.status).toBe(400);
  });

  it("maps 'approve' to resolved and stamps resolved_by/resolved_at", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }] }) // UPDATE
      .mockResolvedValueOnce(mockAdminReportRow({ status: "resolved" })); // re-fetch

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    const [updateSql, updateParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(updateSql).toContain("resolved_by");
    expect(updateSql).toContain("resolved_at = now()");
    expect(updateParams).toContain("resolved");
  });

  it("maps 'review' to investigating without stamping resolved_by/resolved_at", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }] }) // UPDATE
      .mockResolvedValueOnce(mockAdminReportRow({ status: "investigating" })); // re-fetch

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ action: "review" });

    expect(res.status).toBe(200);
    const [updateSql, updateParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(updateSql).not.toContain("resolved_by");
    expect(updateParams).toContain("investigating");
  });

  it("maps 'escalate' to escalated without stamping resolved_by/resolved_at", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }] })
      .mockResolvedValueOnce(mockAdminReportRow({ status: "escalated" }));

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ action: "escalate" });

    expect(res.status).toBe(200);
    const [updateSql, updateParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(updateSql).not.toContain("resolved_by");
    expect(updateParams).toContain("escalated");
  });

  it("updates admin_notes independently of status when only notes are provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: REPORT_ID }] })
      .mockResolvedValueOnce(mockAdminReportRow({ admin_notes: "Following up with reporter" }));

    const res = await request(app)
      .patch(`/api/reports/${REPORT_ID}`)
      .set("Cookie", adminCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ notes: "Following up with reporter" });

    expect(res.status).toBe(200);
    const [updateSql, updateParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(updateSql).toContain("admin_notes");
    expect(updateSql).not.toContain("status =");
    expect(updateParams).toContain("Following up with reporter");
    expect(res.body.report.adminNotes).toBe("Following up with reporter");
  });
});

describe("GET /api/reports/unread-count", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns the count of reports created since the admin last viewed", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ count: "3" }] }); // unread count query

    const res = await request(app).get("/api/reports/unread-count").set("Cookie", adminCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3 });
  });
});

describe("POST /api/reports", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendReportAlertEmail.mockClear();
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/reports").send({ description: "x", country: "Kenya" });

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a missing description", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ country: "Kenya", productName: "Panadol" });

    expect(res.status).toBe(400);
  });

  it("rejects when neither scanId nor productName is provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ description: "Looks fake", country: "Kenya" });

    expect(res.status).toBe(400);
  });

  it("rejects a malformed scanId", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ description: "Looks fake", country: "Kenya", scanId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });

  it("creates a report and alerts the health authority on file for the country", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [reportRow()] }) // INSERT INTO reports
      .mockResolvedValueOnce({ rows: [{ email: "ha@example.com" }] }); // health_authorities lookup

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ description: "Looks fake", country: "Kenya", productName: "Panadol" });

    expect(res.status).toBe(201);
    expect(res.body.report).toEqual(expect.objectContaining({ id: REPORT_ID, status: "pending" }));

    // The health-authority alert is fired after the response is sent (best
    // effort) — give its microtask a tick before asserting on it.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockSendReportAlertEmail).toHaveBeenCalledWith(
      "ha@example.com",
      expect.objectContaining({ productName: "Panadol", country: "Kenya" })
    );
  });

  it("still returns 201 when no health authority is on file for the country", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [reportRow({ country: "Atlantis" })] }) // INSERT INTO reports
      .mockResolvedValueOnce({ rows: [] }); // health_authorities lookup — none found

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ description: "Looks fake", country: "Atlantis", productName: "Panadol" });

    expect(res.status).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockSendReportAlertEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when scanId doesn't reference an existing scan (FK violation)", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockRejectedValueOnce({ code: "23503" }); // INSERT INTO reports — FK violation

    const res = await request(app)
      .post("/api/reports")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ description: "Looks fake", country: "Kenya", scanId: SCAN_ID });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/reports/my", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/reports/my");

    expect(res.status).toBe(401);
  });

  it("returns the current user's reports as summaries (no full photoUrl)", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [reportRow({ photo_url: "data:image/jpeg;base64,abc" })] });

    const res = await request(app).get("/api/reports/my").set("Cookie", userCookie());

    expect(res.status).toBe(200);
    expect(res.body.reports).toEqual([expect.objectContaining({ id: REPORT_ID, hasPhoto: true })]);
    expect(res.body.reports[0].photoUrl).toBeUndefined();
  });
});

describe("GET /api/reports (admin list)", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/reports");

    expect(res.status).toBe(401);
  });

  it("rejects a non-admin user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app).get("/api/reports").set("Cookie", userCookie());

    expect(res.status).toBe(403);
  });

  it("returns paginated admin-shaped reports and marks them viewed", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({
        rows: [{ ...reportRow(), reporter_email: "reporter@example.com", reporter_full_name: "A Reporter", scan_medicine_name: null }],
      }) // list query
      .mockResolvedValueOnce({ rows: [{ count: "1" }] }) // count query
      .mockResolvedValueOnce({ rows: [] }); // reports_last_viewed_at update

    const res = await request(app).get("/api/reports").set("Cookie", adminCookie());

    expect(res.status).toBe(200);
    expect(res.body.reports).toEqual([expect.objectContaining({ id: REPORT_ID, reporter: expect.objectContaining({ email: "reporter@example.com" }) })]);
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, totalCount: 1, totalPages: 1 });

    const [updateSql] = mockQuery.mock.calls[3] as [string, unknown[]];
    expect(updateSql).toContain("reports_last_viewed_at");
  });

  it("filters by status when provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [] }) // list query
      .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // count query
      .mockResolvedValueOnce({ rows: [] }); // reports_last_viewed_at update

    const res = await request(app).get("/api/reports").set("Cookie", adminCookie()).query({ status: "escalated" });

    expect(res.status).toBe(200);
    const [listSql, listParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(listSql).toContain("WHERE r.status = $3");
    expect(listParams).toContain("escalated");
  });
});
