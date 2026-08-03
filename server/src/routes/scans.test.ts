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

const CSRF_TOKEN = "test-csrf-token";

function userCookie(): string {
  const { token } = signAccessToken({ sub: "user-1", role: "consumer" });
  return `hakikisha_access_token=${token}; hakikisha_csrf_token=${CSRF_TOKEN}`;
}

function medicineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "med-1",
    name: "Panadol",
    generic_name: "Paracetamol",
    manufacturer: "GSK",
    dosage_form: "Tablet",
    strength: "500mg",
    barcode: "8901030826524",
    regulatory_body: "PPB",
    approval_number: "PPB/2024/001",
    approval_status: "approved",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    batch_id: "batch-1",
    batch_number: "B1",
    expiry_date: null,
    status: "active",
    ...overrides,
  };
}

describe("POST /api/scans", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a non-numeric barcode", async () => {
    const res = await request(app).post("/api/scans").send({ barcode: "abc" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns UNVERIFIED with no medicine when the barcode isn't in the database", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-1" }] });

    const res = await request(app).post("/api/scans").send({ barcode: "0000000000000" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ status: "UNVERIFIED", scanId: "scan-1", medicine: null })
    );
  });

  it("returns VERIFIED with no message for an approved, in-date medicine", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "approved" })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-2" }] });

    const res = await request(app).post("/api/scans").send({ barcode: "8901030826524" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("VERIFIED");
    expect(res.body.message).toBeUndefined();
  });

  it("returns UNVERIFIED with an expiry-specific message once the batch has expired", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "approved", expiry_date: "2020-01-01T00:00:00.000Z" })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-3" }] });

    const res = await request(app).post("/api/scans").send({ barcode: "8901030826524" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UNVERIFIED");
    expect(res.body.message).toMatch(/batch has expired/);
  });

  it("returns UNVERIFIED with a rejection-specific message for a rejected registration", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "rejected", expiry_date: null })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-4" }] });

    const res = await request(app).post("/api/scans").send({ barcode: "8901030826524" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UNVERIFIED");
    expect(res.body.message).toMatch(/rejected/);
  });

  it("attributes the scan to the logged-in user when an access-token cookie is present", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate (revocation check)
      .mockResolvedValueOnce({ rows: [] }) // medicine+batch lookup
      .mockResolvedValueOnce({ rows: [{ id: "scan-5" }] }); // INSERT INTO scans

    const res = await request(app)
      .post("/api/scans")
      .set("Cookie", userCookie())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ barcode: "0000000000000" });

    expect(res.status).toBe(200);
    const [, insertParams] = mockQuery.mock.calls[2] as [string, unknown[]];
    expect(insertParams[0]).toBe("user-1"); // scanned_by
  });
});

describe("GET /api/scans/my", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/scans/my");

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns the current user's scan history in camelCase", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({
        rows: [
          {
            id: "scan-1",
            barcode: "8901030826524",
            result: "authentic",
            scanned_at: "2026-07-01T00:00:00.000Z",
            medicine_id: "med-1",
            medicine_name: "Panadol",
          },
        ],
      });

    const res = await request(app).get("/api/scans/my").set("Cookie", userCookie());

    expect(res.status).toBe(200);
    expect(res.body.scans).toEqual([
      {
        id: "scan-1",
        barcode: "8901030826524",
        medicineId: "med-1",
        medicineName: "Panadol",
        result: "authentic",
        scannedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });
});
