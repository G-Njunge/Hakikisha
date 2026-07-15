import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import pool from "../db/pool";

export default async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);

  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET as string);

    if (typeof verified === "string" || !verified.sub || !verified.jti) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    payload = verified;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { rows } = await pool.query("SELECT 1 FROM revoked_access_tokens WHERE jti = $1", [payload.jti]);
  if (rows.length > 0) {
    res.status(401).json({ error: "Token has been revoked" });
    return;
  }

  req.user = payload as Request["user"];
  next();
}
