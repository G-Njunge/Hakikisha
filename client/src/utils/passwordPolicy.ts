// Mirrors server/src/lib/passwordPolicy.ts — kept in sync by hand, since
// client/server are separate codebases with no shared package.
export interface PasswordRequirement {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: "length", label: "8+ characters", test: (p) => p.length >= 8 },
  { key: "lowercase", label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { key: "uppercase", label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "A number", test: (p) => /[0-9]/.test(p) },
];

export function validatePasswordStrength(password: string): string | null {
  const failed = PASSWORD_REQUIREMENTS.find((req) => !req.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}
