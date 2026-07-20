import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../db/pool";

// Returns the verified payload, or null if the token is missing/invalid/
// expired/revoked. Shared by `authenticate` (rejects on null) and
// `optionalAuthenticate` (proceeds anonymously on null).
async function verifyAccessToken(req: Request): Promise<Request["user"] | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length);

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

export default async function authenticate(req: Request, res: Response, next: NextFunction) {
  const user = await verifyAccessToken(req);

  if (!user) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
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
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
