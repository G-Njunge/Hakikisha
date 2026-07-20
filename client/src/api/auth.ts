import apiClient from "./client";
import { clearTokens, getRefreshToken, setTokens } from "./tokenStorage";
import type { LoginPayload, RegisterPayload, User } from "../types/auth";

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/api/auth/register", payload);
  return data.user;
}

export async function login(payload: LoginPayload): Promise<User> {
  const { data } = await apiClient.post<{ accessToken: string; refreshToken: string; user: User }>(
    "/api/auth/login",
    payload
  );
  setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  try {
    await apiClient.post("/api/auth/logout", refreshToken ? { refreshToken } : {});
  } finally {
    // Always end the local session, even if the network call failed
    // (offline, server down) — the user asked to log out, so they must
    // re-enter credentials regardless of whether the server heard about it.
    clearTokens();
  }
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
