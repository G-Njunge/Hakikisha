import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import ServerWakingUpPage from "./ServerWakingUpPage";

const HEALTH_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/health`;

// A normal, already-warm request resolves in well under this — only shows
// the buffer page once a delay actually looks like a Render free-tier cold
// start, so a healthy load never flashes it.
const SHOW_BUFFER_AFTER_MS = 1200;
const RETRY_INTERVAL_MS = 3000;
// ~20 retries * 3s ≈ 60s, matching the "30-60s" copy on the buffer page
// itself. If the API is still unreachable after that, something other than
// a cold start is wrong — render the app anyway so its own request/error
// handling can surface whatever that is, rather than trapping the user here.
const MAX_ATTEMPTS = 20;

// Wraps the whole app: on load, pings the API's /health before rendering
// anything that would otherwise fire its own requests (AuthContext's /me
// call, etc.) into a sleeping backend. Render's free tier spins the API down
// after a period of inactivity — the first request afterward can take
// 30-60s to wake it back up, which otherwise just looks like a hung page.
export default function BackendWakeGate({ children }: { children: ReactNode }) {
  const [isAwake, setIsAwake] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bufferTimer = setTimeout(() => {
      if (!cancelled) setShowBuffer(true);
    }, SHOW_BUFFER_AFTER_MS);

    async function pingUntilAwake() {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        try {
          const res = await fetch(HEALTH_URL, { cache: "no-store" });
          if (res.ok) {
            if (!cancelled) setIsAwake(true);
            return;
          }
        } catch {
          // A sleeping Render service can refuse/drop the connection
          // outright while its container is still booting, rather than
          // just responding slowly — treated the same as a slow response.
        }
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
      if (!cancelled) setIsAwake(true);
    }

    pingUntilAwake();

    return () => {
      cancelled = true;
      clearTimeout(bufferTimer);
    };
  }, []);

  if (isAwake) {
    return <>{children}</>;
  }

  return showBuffer ? <ServerWakingUpPage /> : null;
}
