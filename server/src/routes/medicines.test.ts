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

const MEDICINE_ID = "11111111-1111-1111-1111-111111111111";

function medicineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MEDICINE_ID,
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
    ...overrides,
  };
}

describe("GET /api/medicines/search", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a missing q param", async () => {
    const res = await request(app).get("/api/medicines/search");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a blank q param", async () => {
    const res = await request(app).get("/api/medicines/search").query({ q: "   " });

    expect(res.status).toBe(400);
  });

  it("returns paginated, camelCase results for a valid query", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow()] })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });

    const res = await request(app).get("/api/medicines/search").query({ q: "panadol" });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([expect.objectContaining({ id: MEDICINE_ID, genericName: "Paracetamol" })]);
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 10, totalCount: 1, totalPages: 1 });
  });
});

describe("GET /api/medicines/barcode/:barcode", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a non-numeric barcode", async () => {
    const res = await request(app).get("/api/medicines/barcode/not-a-barcode");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns found:false when the barcode isn't in the database", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // medicine+batch lookup
      .mockResolvedValueOnce({ rows: [{ id: "scan-1" }] }); // INSERT INTO scans

    const res = await request(app).get("/api/medicines/barcode/0000000000000");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ found: false, scanId: "scan-1", verificationStatus: "Unknown" })
    );
  });

  it("returns the mapped medicine when the barcode matches", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...medicineRow(), batch_id: "batch-1", batch_number: "B1", expiry_date: null, status: "active" }] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-2" }] });

    const res = await request(app).get("/api/medicines/barcode/8901030826524");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        found: true,
        medicine: expect.objectContaining({ id: MEDICINE_ID }),
        registrationStatus: "Registered",
        verificationStatus: "Verified",
      })
    );
  });
});

describe("GET /api/medicines/:id", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a non-UUID id", async () => {
    const res = await request(app).get("/api/medicines/not-a-uuid");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 404 when no medicine matches", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(`/api/medicines/${MEDICINE_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns the medicine when found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [medicineRow()] });

    const res = await request(app).get(`/api/medicines/${MEDICINE_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ medicine: expect.objectContaining({ id: MEDICINE_ID, name: "Panadol" }) });
  });
});

describe("GET /api/medicines/:id/verification", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a non-UUID id", async () => {
    const res = await request(app).get("/api/medicines/not-a-uuid/verification");

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 404 when no medicine matches", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // medicine
      .mockResolvedValueOnce({ rows: [] }) // photos
      .mockResolvedValueOnce({ rows: [] }); // checklist items

    const res = await request(app).get(`/api/medicines/${MEDICINE_ID}/verification`);

    expect(res.status).toBe(404);
  });

  it("splits photos by angle and checklist items by section", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow()] })
      .mockResolvedValueOnce({ rows: [{ angle: "package", image_url: "/assets/panadol-package.jpg" }] })
      .mockResolvedValueOnce({
        rows: [
          { section: "package_verification", label: "Check the seal is intact" },
          { section: "safety_comparison", label: "Compare tablet color" },
        ],
      });

    const res = await request(app).get(`/api/medicines/${MEDICINE_ID}/verification`);

    expect(res.status).toBe(200);
    expect(res.body.photos).toEqual({ tablet: null, package: "/assets/panadol-package.jpg" });
    expect(res.body.packageVerification).toEqual(["Check the seal is intact"]);
    expect(res.body.safetyComparison).toEqual(["Compare tablet color"]);
  });
});
