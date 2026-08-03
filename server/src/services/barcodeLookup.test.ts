import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../db/pool", () => ({ default: { query: mockQuery } }));

import { lookupBarcode, toMedicineResponse } from "./barcodeLookup";
import type { MedicineRow } from "./barcodeLookup";

function medicineRow(overrides: Partial<MedicineRow & { batch_id: string | null; batch_number: string | null; expiry_date: string | null; status: string | null }> = {}) {
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
    batch_number: "B123",
    expiry_date: null,
    status: "active",
    ...overrides,
  };
}

describe("toMedicineResponse", () => {
  it("maps snake_case db columns to camelCase fields", () => {
    expect(toMedicineResponse(medicineRow())).toEqual({
      id: "med-1",
      name: "Panadol",
      genericName: "Paracetamol",
      manufacturer: "GSK",
      dosageForm: "Tablet",
      strength: "500mg",
      barcode: "8901030826524",
      regulatoryBody: "PPB",
      approvalNumber: "PPB/2024/001",
      approvalStatus: "approved",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("lookupBarcode", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("logs an unknown-result scan and returns found:false when no medicine matches", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // medicine+batch lookup
      .mockResolvedValueOnce({ rows: [{ id: "scan-1" }] }); // INSERT INTO scans

    const result = await lookupBarcode("0000000000000", { latitude: null, longitude: null, scannedBy: null });

    expect(result).toEqual({ found: false, scanId: "scan-1" });
    const [insertSql, insertParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO scans");
    expect(insertParams).toEqual([null, "0000000000000", null, null]);
  });

  it("returns scanResult 'authentic' for an approved, non-expired batch", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "approved", expiry_date: null })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-2" }] });

    const result = await lookupBarcode("8901030826524", { latitude: 1, longitude: 2, scannedBy: "user-1" });

    expect(result).toEqual(
      expect.objectContaining({ found: true, scanId: "scan-2", scanResult: "authentic", batchNumber: "B123" })
    );
    const [, insertParams] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(insertParams).toEqual(["batch-1", "user-1", "8901030826524", "authentic", 1, 2]);
  });

  it("returns scanResult 'expired' when the batch's expiry date has passed, even if approved", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "approved", expiry_date: "2020-01-01T00:00:00.000Z" })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-3" }] });

    const result = await lookupBarcode("8901030826524", { latitude: null, longitude: null, scannedBy: null });

    expect(result).toEqual(expect.objectContaining({ scanResult: "expired" }));
  });

  it("returns scanResult 'unknown' for a non-expired batch that isn't approved", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ approval_status: "pending", expiry_date: null })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-4" }] });

    const result = await lookupBarcode("8901030826524", { latitude: null, longitude: null, scannedBy: null });

    expect(result).toEqual(expect.objectContaining({ scanResult: "unknown" }));
  });

  it("falls back batchNumber to null when the medicine has no batch record", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [medicineRow({ batch_id: null, batch_number: null })] })
      .mockResolvedValueOnce({ rows: [{ id: "scan-5" }] });

    const result = await lookupBarcode("8901030826524", { latitude: null, longitude: null, scannedBy: null });

    expect(result).toEqual(expect.objectContaining({ batchNumber: null }));
  });
});
