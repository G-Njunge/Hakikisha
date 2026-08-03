import apiClient from "./client";
import { setCsrfToken } from "./csrf";
import type { LoginPayload, RegisterPayload, User } from "../types/auth";

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/api/auth/register", payload);
  return data.user;
}

export async function login(payload: LoginPayload, remember: boolean): Promise<User> {
  const { data } = await apiClient.post<{ user: User; csrfToken: string }>("/api/auth/login", { ...payload, remember });
  setCsrfToken(data.csrfToken);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    // The server reads its own refresh cookie and clears all three auth
    // cookies in the response — nothing client-side left to clean up.
    await apiClient.post("/api/auth/logout");
  } finally {
    setCsrfToken(null);
  }
}

export async function fetchCurrentUser(): Promise<User> {
  // Also resyncs the in-memory CSRF token (see csrf.ts) — a fresh page
  // load/reload has nothing else to restore it from.
  const { data } = await apiClient.get<{ user: User; csrfToken: string | null }>("/api/auth/me");
  setCsrfToken(data.csrfToken);
  return data.user;
}

export async function updateDisplayName(fullName: string): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>("/api/auth/me", { fullName });
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/api/auth/change-password", { currentPassword, newPassword });
}

export interface EmailCheckResult {
  validFormat: boolean;
  available: boolean | null;
}

export async function checkEmailAvailability(email: string): Promise<EmailCheckResult> {
  const { data } = await apiClient.get<EmailCheckResult>("/api/auth/check-email", { params: { email } });
  return data;
}
