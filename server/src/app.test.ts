import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("./db/pool", () => ({
  default: {
    query: mockQuery,
  },
}));

// Registration now sends a verification email as a side effect — without
// this mock, the test makes a real network call to Resend, which is slow
// enough to blow past the test timeout (and shouldn't be hitting a real
// third-party API from a test at all).
vi.mock("./lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendReportAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "./app";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("Email verification", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("normalizes mixed-case emails before checking availability", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "1" }] });

    const res = await request(app).get("/api/auth/check-email").query({ email: "User@Example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ validFormat: true, available: false });
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1 FROM users WHERE email = $1", ["user@example.com"]);
  });

  it("normalizes emails before registering a new user", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            email: "newuser@example.com",
            full_name: "Jane Doe",
            country: "Kenya",
            role: "consumer",
            is_verified: false,
            created_at: "2026-07-20T00:00:00.000Z",
          },
        ],
      });

    const res = await request(app).post("/api/auth/register").send({
      email: "NewUser@Example.com",
      password: "password123",
      fullName: "Jane Doe",
      country: "Kenya",
      role: "consumer",
    });

    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenNthCalledWith(1, "SELECT id FROM users WHERE email = $1", ["newuser@example.com"]);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO users"),
      ["newuser@example.com", expect.any(String), "Jane Doe", "Kenya", "consumer"]
    );
  });
});
