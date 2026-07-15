import { createHash, randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload) {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m") as jwt.SignOptions["expiresIn"],
  });
  return { token, jti };
}

export function generateRefreshToken() {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, expiresAt };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
