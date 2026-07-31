import { randomBytes } from "crypto";
import { Response } from "express";

const isProd = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE = "hakikisha_access_token";
export const REFRESH_COOKIE = "hakikisha_refresh_token";
export const CSRF_COOKIE = "hakikisha_csrf_token";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// localhost:5173 and localhost:5000 are same-site regardless of port, so Lax
// (no Secure) works for local dev over http. Production is genuinely
// cross-origin (separate Railway/static-host domains), so SameSite=None
// requires Secure — browsers reject None cookies without it.
const baseAttrs = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function setAuthCookies(
  res: Response,
  opts: { accessToken: string; refreshToken: string; csrfToken: string; remember: boolean }
): void {
  const persistMs = opts.remember ? THIRTY_DAYS_MS : undefined;

  res.cookie(ACCESS_COOKIE, opts.accessToken, { ...baseAttrs, maxAge: ONE_HOUR_MS });
  // Scoped to /api/auth — refresh/logout are the only routes that need to see it.
  res.cookie(REFRESH_COOKIE, opts.refreshToken, { ...baseAttrs, path: "/api/auth", maxAge: persistMs });
  // Not httpOnly — the client reads this to echo it back as the X-CSRF-Token header.
  res.cookie(CSRF_COOKIE, opts.csrfToken, { ...baseAttrs, httpOnly: false, maxAge: persistMs });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseAttrs);
  res.clearCookie(REFRESH_COOKIE, { ...baseAttrs, path: "/api/auth" });
  res.clearCookie(CSRF_COOKIE, { ...baseAttrs, httpOnly: false });
}
