import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db/pool";
import authenticate from "../middleware/auth";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  signEmailVerificationToken,
  verifyEmailVerificationToken,
} from "../lib/tokens";
import { sendVerificationEmail } from "../lib/email";

const router = Router();

// Practical format check, not full RFC 5322 — good enough to catch typos
// without rejecting real-world addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELF_REGISTER_ROLES = ["manufacturer", "pharmacist", "consumer"] as const;
type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isSelfRegisterRole(value: unknown): value is SelfRegisterRole {
  return typeof value === "string" && (SELF_REGISTER_ROLES as readonly string[]).includes(value);
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  country: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

function toUserResponse(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    country: row.country,
    role: row.role,
    isVerified: row.is_verified,
    createdAt: row.created_at,
  };
}

async function issueRefreshToken(userId: string) {
  const { token, expiresAt } = generateRefreshToken();
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expiresAt]
  );
  return token;
}

// Lets the registration form validate an email before submitting the whole
// form — 400 only for genuine API misuse (missing param); a malformed or
// already-taken email is a normal, expected answer, not an error.
router.get("/check-email", async (req, res) => {
  const { email } = req.query;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    res.status(200).json({ validFormat: false, available: null });
    return;
  }

  const { rows } = await pool.query("SELECT 1 FROM users WHERE email = $1", [normalizedEmail]);

  res.status(200).json({ validFormat: true, available: rows.length === 0 });
});

router.post("/register", async (req, res) => {
  const { email, password, fullName, country, role } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (
    typeof password !== "string" ||
    typeof fullName !== "string" ||
    typeof country !== "string" ||
    country.trim().length === 0 ||
    !normalizedEmail
  ) {
    res.status(400).json({ error: "email, password, fullName, and country are required" });
    return;
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }

  const resolvedRole: SelfRegisterRole = isSelfRegisterRole(role) ? role : "consumer";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, country, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, full_name, country, role, is_verified, created_at`,
    [normalizedEmail, passwordHash, fullName, country, resolvedRole]
  );
  const user = rows[0];

  // Verification email failing to send shouldn't fail account creation —
  // the account is fully usable unverified; log it and move on.
  try {
    const verificationToken = signEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, user.full_name, verificationToken);
  } catch (err) {
    console.error("Failed to send verification email", err);
  }

  res.status(201).json({ user: toUserResponse(user) });
});

// Renders a small self-contained HTML page rather than JSON or a redirect —
// this is a link clicked directly from an email client, not an API call a
// frontend is driving, so there's no SPA involved on either end.
function verifyEmailPage(title: string, message: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; max-width: 420px; text-align: center; }
      h1 { font-size: 20px; color: #111827; margin: 0 0 8px; }
      p { font-size: 14px; color: #374151; line-height: 22px; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (typeof token !== "string" || token.length === 0) {
    res.status(400).type("html").send(verifyEmailPage("Invalid link", "This verification link is missing its token."));
    return;
  }

  const userId = verifyEmailVerificationToken(token);
  if (!userId) {
    res
      .status(400)
      .type("html")
      .send(
        verifyEmailPage(
          "Link expired or invalid",
          "This verification link is invalid or has expired. Please request a new one."
        )
      );
    return;
  }

  const { rows } = await pool.query<{ id: string }>(
    "UPDATE users SET is_verified = true, updated_at = now() WHERE id = $1 RETURNING id",
    [userId]
  );

  if (rows.length === 0) {
    res
      .status(404)
      .type("html")
      .send(verifyEmailPage("Account not found", "We couldn't find an account matching this verification link."));
    return;
  }

  res
    .status(200)
    .type("html")
    .send(verifyEmailPage("Email verified", "Your email address has been verified. You can now close this page and log in to Hakikisha."));
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const { rows } = await pool.query<UserRow & { password_hash: string }>(
    "SELECT id, email, password_hash, full_name, country, role, is_verified, created_at FROM users WHERE email = $1",
    [normalizedEmail]
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
    user: toUserResponse(user),
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
  const { rows } = await pool.query<UserRow>(
    "SELECT id, email, full_name, country, role, is_verified, created_at FROM users WHERE id = $1",
    [req.user?.sub]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ user: toUserResponse(rows[0]) });
});

router.patch("/me", authenticate, async (req, res) => {
  const { fullName } = req.body ?? {};

  if (typeof fullName !== "string" || fullName.trim().length === 0) {
    res.status(400).json({ error: "fullName is required" });
    return;
  }

  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET full_name = $1, updated_at = now() WHERE id = $2
     RETURNING id, email, full_name, country, role, is_verified, created_at`,
    [fullName.trim(), req.user?.sub]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ user: toUserResponse(rows[0]) });
});

router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "newPassword must be at least 8 characters" });
    return;
  }

  const { rows } = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [req.user?.sub]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const currentMatches = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!currentMatches) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    newPasswordHash,
    req.user?.sub,
  ]);

  // Changing the password invalidates every other session — standard
  // practice so a leaked refresh token stops working once the password
  // that (presumably) leaked alongside it is rotated out.
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [req.user?.sub]
  );

  res.status(204).send();
});

export default router;
