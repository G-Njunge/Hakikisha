// The CSRF cookie is set by the API's own origin, not the client's — in
// production the client and API are genuinely different domains, and a
// cookie set by one origin's response is invisible to document.cookie on a
// *different* origin's page (regardless of SameSite/Secure), even though the
// browser still attaches it automatically to requests back to that origin.
// So instead of reading the cookie directly, the server echoes its current
// value back in the JSON body of /login, /refresh, and /me (see auth.ts),
// and this module just holds onto whatever value it was told most recently.
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}
