import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

const apiClient = axios.create({ baseURL });

const AUTH_ENDPOINTS = ["/api/auth/login", "/api/auth/register"];

function isAuthEndpoint(url?: string): boolean {
  return !!url && AUTH_ENDPOINTS.some((path) => url.includes(path));
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    // Plain axios, not apiClient, so this call bypasses the response
    // interceptor below and can't recursively trigger another refresh.
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/api/auth/refresh`,
      { refreshToken }
    );
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch (err) {
    // Refresh tokens are single-use. If another tab (sharing this origin's
    // localStorage) already rotated this exact token while we were mid-flight,
    // our attempt fails but the session is still alive under their new token
    // — adopt it instead of forcing a needless logout.
    const currentRefreshToken = getRefreshToken();
    const currentAccessToken = getAccessToken();
    if (currentAccessToken && currentRefreshToken && currentRefreshToken !== refreshToken) {
      return currentAccessToken;
    }
    throw err;
  }
}

// Refresh tokens rotate on every use, so concurrent refreshes must not race
// each other. Web Locks serializes refreshes across every tab sharing this
// origin's localStorage; the in-memory promise is the same-tab fallback for
// browsers without Web Locks support.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
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
      const newAccessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearTokens();
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
