import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.JWT_SECRET ??= "test_secret_not_real";

const { mockQuery, mockIsOpenNow } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockIsOpenNow: vi.fn(),
}));

vi.mock("../db/pool", () => ({ default: { query: mockQuery } }));
vi.mock("../lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendReportAlertEmail: vi.fn().mockResolvedValue(undefined),
}));
// isOpenNow reads the real wall clock by default — mocked here so the
// openNow filter can be tested deterministically instead of depending on
// whatever time the test happens to run at.
vi.mock("../lib/pharmacyHours", () => ({ isOpenNow: mockIsOpenNow }));

import app from "../app";

const MEDICINE_ID = "11111111-1111-1111-1111-111111111111";

function pharmacyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pharmacy-1",
    name: "Kigali Central Pharmacy",
    address: "KN 4 Ave",
    latitude: -1.9536,
    longitude: 30.0605,
    phone: "+250780000000",
    hours: "Mon-Sat 08:00-20:00",
    distance_km: 1.2345,
    stocks_medicine: null,
    ...overrides,
  };
}

describe("GET /api/pharmacies/nearby", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockIsOpenNow.mockReset();
  });

  it("rejects a request missing lat/lng", async () => {
    const res = await request(app).get("/api/pharmacies/nearby").query({ lat: "-1.95" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a malformed medicineId", async () => {
    const res = await request(app)
      .get("/api/pharmacies/nearby")
      .query({ lat: "-1.95", lng: "30.06", medicineId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rounds distanceKm to one decimal and attaches isOpenNow per pharmacy", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [pharmacyRow()] });
    mockIsOpenNow.mockReturnValueOnce(true);

    const res = await request(app).get("/api/pharmacies/nearby").query({ lat: "-1.95", lng: "30.06" });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      expect.objectContaining({ id: "pharmacy-1", distanceKm: 1.2, isOpenNow: true }),
    ]);
  });

  it("passes the medicineId through so stock can be sorted/flagged", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [pharmacyRow({ stocks_medicine: true })] });
    mockIsOpenNow.mockReturnValueOnce(null);

    const res = await request(app)
      .get("/api/pharmacies/nearby")
      .query({ lat: "-1.95", lng: "30.06", medicineId: MEDICINE_ID });

    expect(res.status).toBe(200);
    expect(res.body.results[0].stocksMedicine).toBe(true);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(MEDICINE_ID);
  });

  it("filters out closed pharmacies when openNow=true", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [pharmacyRow({ id: "open-1" }), pharmacyRow({ id: "closed-1" })],
    });
    mockIsOpenNow.mockReturnValueOnce(true).mockReturnValueOnce(false);

    const res = await request(app)
      .get("/api/pharmacies/nearby")
      .query({ lat: "-1.95", lng: "30.06", openNow: "true" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].id).toBe("open-1");
  });

  it("keeps unknown-hours pharmacies out of the openNow=true filter (null isn't true)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [pharmacyRow()] });
    mockIsOpenNow.mockReturnValueOnce(null);

    const res = await request(app)
      .get("/api/pharmacies/nearby")
      .query({ lat: "-1.95", lng: "30.06", openNow: "true" });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });
});
