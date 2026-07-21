const ACCESS_TOKEN_KEY = "hakikisha_access_token";
const REFRESH_TOKEN_KEY = "hakikisha_refresh_token";

// Fired when tokens are cleared because a background refresh failed (session
// truly expired), as opposed to an explicit user-initiated logout. AuthContext
// listens for this so its `user` state doesn't go stale — without it, the UI
// would keep showing a logged-in user whose every request now 401s.
export const SESSION_EXPIRED_EVENT = "hakikisha:session-expired";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
