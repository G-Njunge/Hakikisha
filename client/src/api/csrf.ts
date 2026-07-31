const CSRF_COOKIE = "hakikisha_csrf_token";

// The auth cookies are httpOnly (unreadable by JS, by design); this one
// isn't, specifically so it can be echoed back as a header — an attacker's
// cross-site request gets the cookie attached automatically by the browser
// but can't read it to set a matching X-CSRF-Token header.
export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
