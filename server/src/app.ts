import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import authRouter from "./routes/auth";
import medicinesRouter from "./routes/medicines";
import pharmaciesRouter from "./routes/pharmacies";
import scansRouter from "./routes/scans";
import reportsRouter from "./routes/reports";
import adminRouter from "./routes/admin";
import csrfProtection from "./middleware/csrf";
import rateLimiter from "./middleware/rateLimiter";
import { openapiSpec } from "./docs/openapiSpec";

const app = express();

const isProd = process.env.NODE_ENV === "production";

// Railway (and most PaaS hosts) terminate TLS at a proxy in front of the
// app, so req.ip / req.secure would otherwise reflect the proxy, not the
// real client — this makes both the rate limiter's IP bucketing and the
// HTTPS-redirect check below trust the platform's X-Forwarded-* headers.
if (isProd) {
  app.set("trust proxy", 1);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    next();
  });
}

app.use(
  helmet({
    // verify-email renders a real browser-navigated HTML page with an
    // inline <style> block (fixed strings only, never user input — no live
    // XSS vector, this is just CSP hygiene needing the relaxation to render).
    // swagger-ui-express's docs page similarly needs 'unsafe-inline' script-src
    // to run its bootstrapping <script> block — same reasoning: fixed content,
    // not user input, and this API serves no other user-facing HTML.
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'", "'unsafe-inline'"],
      },
    },
    // This API is deliberately consumed cross-origin by the SPA.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Origins never have a trailing slash, but env vars are easy to mistype with
// one — strip it so a stray "/" in CLIENT_URL can't silently break every
// cross-origin request with a CORS mismatch that looks like a backend bug.
const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/+$/, "");

// credentials: true is required for the browser to send/accept the httpOnly
// auth cookies cross-origin; safe alongside a single fixed origin (never a
// wildcard) since only that origin's requests can carry them.
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(cookieParser());
// Raised from Express's 100kb default so report submissions can carry a
// base64-encoded photo (interim storage until real object-storage/URLs).
app.use(express.json({ limit: "8mb" }));

app.use(rateLimiter);
app.use(csrfProtection);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// GET-only, so untouched by csrfProtection (which only checks mutating
// methods) — left reachable in production, consistent with the SRS's own
// note that health-authority stakeholders may want to review the platform's
// reporting capabilities.
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use("/api/auth", authRouter);
app.use("/api/medicines", medicinesRouter);
app.use("/api/pharmacies", pharmaciesRouter);
app.use("/api/scans", scansRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/admin", adminRouter);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
