import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

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

// Mutating requests (POST/PATCH/PUT/DELETE) outside of register/login/refresh
// require the double-submit CSRF cookie and a matching X-CSRF-Token header —
// this bundles both alongside the access-token cookie so authenticated
// mutating requests in these tests don't 403 before reaching route logic.
function authCookies(overrides: { sub?: string; role?: string } = {}): string {
  const { token } = signAccessToken({ sub: overrides.sub ?? "user-1", role: overrides.role ?? "consumer" });
  return `hakikisha_access_token=${token}; hakikisha_csrf_token=${CSRF_TOKEN}`;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a password that doesn't meet complexity requirements", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "weak@example.com",
      password: "alllowercase1",
      fullName: "Weak Password",
      country: "Kenya",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uppercase/);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects an unknown email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects the wrong password", async () => {
    const passwordHash = await bcrypt.hash("CorrectPassword1", 12);
    mockQuery.mockResolvedValueOnce({
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
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "WrongPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a request with no refresh token cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired refresh token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "hakikisha_refresh_token=some-stale-token");

    expect(res.status).toBe(401);
  });

  it("rotates the refresh token and re-sets all three cookies on success", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "rt-1", user_id: "user-1", remember: true, role: "consumer" }] })
      .mockResolvedValueOnce({ rows: [] }) // revoke old token
      .mockResolvedValueOnce({ rows: [] }); // issue new refresh token

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "hakikisha_refresh_token=some-valid-token");

    expect(res.status).toBe(200);
    // Returned in the body too (not just the cookie) — the client can't read
    // this cookie via document.cookie when client/server are cross-origin.
    expect(res.body).toEqual({ csrfToken: expect.any(String) });
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("hakikisha_access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("hakikisha_refresh_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("hakikisha_csrf_token="))).toBe(true);
    // remember: true was carried forward from the stored row, so the refresh
    // cookie should be persistent (Max-Age set), not a session cookie.
    const refreshCookie = cookies.find((c) => c.startsWith("hakikisha_refresh_token="));
    expect(refreshCookie).toMatch(/Max-Age=/i);
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("clears all auth cookies", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate: revoked_access_tokens check
      .mockResolvedValueOnce({ rows: [] }); // insert into revoked_access_tokens

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", authCookies())
      .set("X-CSRF-Token", CSRF_TOKEN);

    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("hakikisha_access_token=") && /Expires=Thu, 01 Jan 1970/.test(c))).toBe(
      true
    );
  });
});

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("rejects a weak new password before touching the database", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // authenticate: revoked_access_tokens check

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", authCookies())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ currentPassword: "whatever", newPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/);
  });

  it("rejects the wrong current password", async () => {
    const storedHash = await bcrypt.hash("ActualPassword1", 12);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ password_hash: storedHash }] }); // select password_hash

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", authCookies())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ currentPassword: "WrongPassword1", newPassword: "NewPassword1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Current password is incorrect");
  });

  it("changes the password on success", async () => {
    const storedHash = await bcrypt.hash("ActualPassword1", 12);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ password_hash: storedHash }] }) // select password_hash
      .mockResolvedValueOnce({ rows: [] }) // update users
      .mockResolvedValueOnce({ rows: [] }); // revoke other refresh tokens

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", authCookies())
      .set("X-CSRF-Token", CSRF_TOKEN)
      .send({ currentPassword: "ActualPassword1", newPassword: "NewPassword1" });

    expect(res.status).toBe(204);
  });
});
