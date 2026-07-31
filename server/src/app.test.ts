import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

// app.ts is imported directly below (bypassing index.ts's dotenv.config()),
// so JWT_SECRET wouldn't otherwise exist in this process — needed for the
// Login test, which exercises signAccessToken for real. CI sets this via
// its own env var; this is the equivalent for local `npm test` runs.
process.env.JWT_SECRET ??= "test_secret_not_real";

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

describe("Login", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("sets httpOnly auth cookies and returns no tokens in the response body", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            email: "jane@example.com",
            password_hash: passwordHash,
            full_name: "Jane Doe",
            country: "Kenya",
            role: "consumer",
            is_verified: true,
            created_at: "2026-07-20T00:00:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // INSERT INTO refresh_tokens

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "password123", remember: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: expect.objectContaining({ email: "jane@example.com" }) });
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("hakikisha_access_token=") && /HttpOnly/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith("hakikisha_refresh_token=") && /HttpOnly/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith("hakikisha_csrf_token=") && !/HttpOnly/i.test(c))).toBe(true);
  });
});
