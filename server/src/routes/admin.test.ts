import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.JWT_SECRET ??= "test_secret_not_real";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../db/pool", () => ({ default: { query: mockQuery } }));
vi.mock("../lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendReportAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../app";
import { signAccessToken } from "../lib/tokens";

function adminCookie(): string {
  const { token } = signAccessToken({ sub: "admin-1", role: "admin" });
  return `hakikisha_access_token=${token}`;
}

function userCookie(): string {
  const { token } = signAccessToken({ sub: "user-1", role: "consumer" });
  return `hakikisha_access_token=${token}`;
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/admin/stats");

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a non-admin user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate

    const res = await request(app).get("/api/admin/stats").set("Cookie", userCookie());

    expect(res.status).toBe(403);
  });

  it("zero-fills roles/results/statuses that had no rows, and sums totals from what did", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ role: "admin", count: "2" }, { role: "consumer", count: "10" }] }) // users by role
      .mockResolvedValueOnce({ rows: [{ count: "32" }] }) // medicines
      .mockResolvedValueOnce({ rows: [{ count: "46" }] }) // pharmacies
      .mockResolvedValueOnce({ rows: [{ result: "authentic", count: "7" }] }) // scans by result
      .mockResolvedValueOnce({ rows: [{ day: new Date().toISOString().slice(0, 10), count: "3" }] }) // scan trend
      .mockResolvedValueOnce({ rows: [{ status: "escalated", count: "1" }] }) // reports by status
      .mockResolvedValueOnce({ rows: [{ name: "Panadol", count: "5" }] }) // top scanned medicines
      .mockResolvedValueOnce({ rows: [] }); // recent reports

    const res = await request(app).get("/api/admin/stats").set("Cookie", adminCookie());

    expect(res.status).toBe(200);
    expect(res.body.usersByRole).toEqual({ admin: 2, manufacturer: 0, pharmacist: 0, consumer: 10 });
    expect(res.body.totalUsers).toBe(12);
    expect(res.body.scansByResult).toEqual({ authentic: 7, expired: 0, unknown: 0 });
    expect(res.body.totalScans).toBe(7);
    expect(res.body.reportsByStatus).toEqual({ pending: 0, investigating: 0, escalated: 1, resolved: 0, dismissed: 0 });
    expect(res.body.totalReports).toBe(1);
    expect(res.body.totalMedicines).toBe(32);
    expect(res.body.totalPharmacies).toBe(46);
    expect(res.body.topScannedMedicines).toEqual([{ name: "Panadol", count: 5 }]);
  });

  it("returns a 7-entry trend with today's real count and zeros for quiet days", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [] }) // users by role
      .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // medicines
      .mockResolvedValueOnce({ rows: [{ count: "0" }] }) // pharmacies
      .mockResolvedValueOnce({ rows: [] }) // scans by result
      .mockResolvedValueOnce({ rows: [{ day: new Date().toISOString().slice(0, 10), count: "4" }] }) // scan trend
      .mockResolvedValueOnce({ rows: [] }) // reports by status
      .mockResolvedValueOnce({ rows: [] }) // top scanned medicines
      .mockResolvedValueOnce({ rows: [] }); // recent reports

    const res = await request(app).get("/api/admin/stats").set("Cookie", adminCookie());

    expect(res.status).toBe(200);
    expect(res.body.scansLast7Days).toHaveLength(7);
    expect(res.body.scansLast7Days[6]).toEqual({ date: new Date().toISOString().slice(0, 10), count: 4 });
    expect(res.body.scansLast7Days[0].count).toBe(0);
  });
});
