// SRS FR1.2 asks for "minimum complexity" without specifics — this is a
// moderate, commonly-used baseline (no symbol requirement, to avoid undue
// registration friction). Mirrored client-side in client/src/utils/passwordPolicy.ts
// (kept in sync by hand — no shared package between the two codebases).
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  return null;
}
