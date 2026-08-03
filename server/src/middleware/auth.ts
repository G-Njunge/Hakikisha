import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../db/pool";
import { ACCESS_COOKIE } from "../lib/cookies";

async function computeVerifiedUser(req: Request): Promise<Request["user"] | null> {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET as string);
    if (typeof verified === "string" || !verified.sub || !verified.jti) {
      return null;
    }
    payload = verified;
  } catch {
    return null;
  }

  const { rows } = await pool.query("SELECT 1 FROM revoked_access_tokens WHERE jti = $1", [payload.jti]);
  if (rows.length > 0) {
    return null;
  }

  return payload as Request["user"];
}

// Per-request memoization: the rate limiter calls this independently for
// both its `limit` and `keyGenerator` resolvers, and `authenticate`/
// `optionalAuthenticate` call it again — without caching, a single
// authenticated request would run the JWT-verify + revocation-check query
// up to three times. Keyed by the request object itself, so it's scoped to
// one request and needs no manual cleanup (garbage-collected with the req).
const verifiedUserCache = new WeakMap<Request, Promise<Request["user"] | null>>();

// Returns the verified payload, or null if the token is missing/invalid/
// expired/revoked. Shared by `authenticate` (rejects on null),
// `optionalAuthenticate` (proceeds anonymously on null), and the rate
// limiter (to bucket by user vs. IP).
export function verifyAccessToken(req: Request): Promise<Request["user"] | null> {
  let cached = verifiedUserCache.get(req);
  if (!cached) {
    cached = computeVerifiedUser(req);
    verifiedUserCache.set(req, cached);
  }
  return cached;
}

export default async function authenticate(req: Request, res: Response, next: NextFunction) {
  const user = await verifyAccessToken(req);

  if (!user) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }

  req.user = user;
  next();
}

// For routes that must work anonymously (e.g. scanning) but should still
// attribute the request to a user when a valid token is present. Never
// rejects — a missing/invalid/expired token just means req.user stays unset.
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const user = await verifyAccessToken(req);
  if (user) {
    req.user = user;
  }
  next();
}

// Must run after `authenticate` — relies on req.user already being set.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "You don't have access to this page." });
    return;
  }
  next();
}
