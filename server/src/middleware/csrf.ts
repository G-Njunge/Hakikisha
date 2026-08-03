import { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE, CSRF_COOKIE } from "../lib/cookies";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// No session cookie exists yet at these points, so there's nothing for a
// double-submit check to compare against; login-CSRF itself is accepted as
// out of scope.
const EXEMPT_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
]);

// Double-submit cookie check: the CSRF cookie is readable by JS (unlike the
// auth cookies) specifically so the client can echo it back as a header —
// an attacker's cross-site form/fetch can make the browser attach the
// cookie automatically, but can't read it to set a matching header.
export default function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  // No access-token cookie means no authenticated session to ride on — a
  // forged cross-site request here can't do anything a truly anonymous
  // request couldn't already do (e.g. POST /api/scans, which intentionally
  // allows anonymous barcode scanning). Once a session cookie exists, the
  // double-submit check below applies as normal.
  const accessToken = req.cookies?.[ACCESS_COOKIE];
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];

  if (typeof cookieToken !== "string" || cookieToken.length === 0 || cookieToken !== headerToken) {
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  next();
}
