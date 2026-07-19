// Full set of roles a user account can have. Only a subset is selectable via
// self-registration (see SelfRegisterRole) — "admin" accounts are provisioned
// directly, not through POST /api/auth/register.
export type Role = "admin" | "manufacturer" | "pharmacist" | "consumer";
export type SelfRegisterRole = Exclude<Role, "admin">;

export interface User {
  id: string;
  email: string;
  fullName: string;
  country: string;
  role: Role;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  country: string;
  role: SelfRegisterRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}
