import apiClient from "./client";
import { clearTokens, getRefreshToken } from "./tokenStorage";

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
