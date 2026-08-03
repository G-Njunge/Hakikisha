import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getCsrfToken, setCsrfToken } from "./csrf";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// Fired when a background token refresh fails (session truly expired), as
// opposed to an explicit user-initiated logout. AuthContext listens for this
// so its `user` state doesn't go stale — without it, the UI would keep
// showing a logged-in user whose every request now 401s.
export const SESSION_EXPIRED_EVENT = "hakikisha:session-expired";

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

// withCredentials so the browser attaches the httpOnly auth cookies (and
// receives new Set-Cookie headers) on every cross-origin request.
const apiClient = axios.create({ baseURL, withCredentials: true });

const AUTH_ENDPOINTS = ["/api/auth/login", "/api/auth/register"];

function isAuthEndpoint(url?: string): boolean {
  return !!url && AUTH_ENDPOINTS.some((path) => url.includes(path));
}

apiClient.interceptors.request.use((config) => {
  if (config.method && MUTATING_METHODS.has(config.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

async function performRefresh(): Promise<void> {
  // Plain axios, not apiClient, so this call bypasses the response
  // interceptor below and can't recursively trigger another refresh.
  const { data } = await axios.post<{ csrfToken: string }>(
    `${baseURL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  );
  // The refresh rotates the CSRF cookie too — resync the in-memory copy (see
  // csrf.ts) or every mutating request after a refresh would 403.
  setCsrfToken(data.csrfToken);
}

// Refresh tokens rotate on every use, so concurrent refreshes must not race
// each other. Web Locks serializes refreshes across every tab sharing this
// origin's cookies; the in-memory promise is the same-tab fallback for
// browsers without Web Locks support.
let refreshPromise: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request("hakikisha-token-refresh", () => performRefresh());
  }

  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      !isAuthEndpoint(originalRequest.url);

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    try {
      await refreshSession();
      // The refreshed access + CSRF cookies are picked up automatically:
      // the browser resends the access cookie, and the request interceptor
      // re-reads the (now-rotated) CSRF cookie when this retry re-runs it.
      return apiClient(originalRequest);
    } catch (refreshError) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
