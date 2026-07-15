export type Role = "manufacturer" | "pharmacist" | "consumer";

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
  role: Role;
}

export interface LoginPayload {
  email: string;
  password: string;
}
