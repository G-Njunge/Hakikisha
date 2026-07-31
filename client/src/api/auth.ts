import apiClient from "./client";
import type { LoginPayload, RegisterPayload, User } from "../types/auth";

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/api/auth/register", payload);
  return data.user;
}

export async function login(payload: LoginPayload, remember: boolean): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/api/auth/login", { ...payload, remember });
  return data.user;
}

export async function logout(): Promise<void> {
  // The server reads its own refresh cookie and clears all three auth
  // cookies in the response — nothing client-side left to clean up.
  await apiClient.post("/api/auth/logout");
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>("/api/auth/me");
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
