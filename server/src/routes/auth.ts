import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db/pool";
import authenticate from "../middleware/auth";
import { generateRefreshToken, hashToken, signAccessToken } from "../lib/tokens";

const router = Router();

const SELF_REGISTER_ROLES = ["manufacturer", "pharmacist", "consumer"] as const;
type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

function isSelfRegisterRole(value: unknown): value is SelfRegisterRole {
  return typeof value === "string" && (SELF_REGISTER_ROLES as readonly string[]).includes(value);
}

async function issueRefreshToken(userId: string) {
  const { token, expiresAt } = generateRefreshToken();
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expiresAt]
  );
  return token;
}

router.post("/register", async (req, res) => {
  const { email, password, fullName, role } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || typeof fullName !== "string") {
    res.status(400).json({ error: "email, password, and fullName are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }

  const resolvedRole: SelfRegisterRole = isSelfRegisterRole(role) ? role : "consumer";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, is_verified, created_at`,
    [email, passwordHash, fullName, resolvedRole]
  );

  res.status(201).json({ user: rows[0] });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const { rows } = await pool.query(
    "SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const { token: accessToken } = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  res.status(200).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
  });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};

  if (typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  const { rows } = await pool.query(
    `SELECT rt.id, rt.user_id, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [hashToken(refreshToken)]
  );
  const stored = rows[0];

  if (!stored) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  // Rotate on every use: revoke the presented token and issue a fresh pair,
  // so a stolen-but-already-used refresh token can't be replayed.
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [stored.id]);

  const { token: accessToken } = signAccessToken({ sub: stored.user_id, role: stored.role });
  const newRefreshToken = await issueRefreshToken(stored.user_id);

  res.status(200).json({ accessToken, refreshToken: newRefreshToken });
});

router.post("/logout", authenticate, async (req, res) => {
  const { refreshToken } = req.body ?? {};

  await pool.query(
    `INSERT INTO revoked_access_tokens (jti, expires_at)
     VALUES ($1, to_timestamp($2))
     ON CONFLICT (jti) DO NOTHING`,
    [req.user?.jti, req.user?.exp]
  );

  if (typeof refreshToken === "string") {
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND user_id = $2",
      [hashToken(refreshToken), req.user?.sub]
    );
  }

  res.status(204).send();
});

router.get("/me", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, full_name, role, is_verified, created_at FROM users WHERE id = $1",
    [req.user?.sub]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ user: rows[0] });
});

export default router;
