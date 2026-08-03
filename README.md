# Hakikisha

Hakikisha ("assurance" / "make certain" in Swahili) is a medicine authenticity verification tool. Consumers scan a medicine's barcode (camera, photo upload, or manual entry) and are walked through a guided flow to confirm the product is genuine: the medicine is identified against a local registry, matched against reference tablet/package photos, checked against a genuine-package checklist, and finally pointed to nearby pharmacies — visualized on a map — that currently stock it and are open. Suspicious products can be reported, which alerts the relevant national medicines regulator by email.

## Tech stack

**Client** — React 19 + TypeScript, Vite, React Router 7, Axios, Leaflet + React-Leaflet (map). Barcode decoding is split across two engines: `html5-qrcode` drives the live camera feed, while photo-upload decoding uses `zxing-wasm` (real ZXing-C++ compiled to WebAssembly, self-hosted rather than CDN-fetched) — the camera feed can be physically reoriented in real time, but a single uploaded photo needs a decoder that actually tries rotated/skewed orientations, which `html5-qrcode`'s bundled JS decoder doesn't.
**Server** — Node.js, Express 5 + TypeScript, PostgreSQL (`pg`), JWT auth (`jsonwebtoken`) stored in httpOnly cookies with refresh-token rotation and double-submit CSRF protection, `bcryptjs` (cost factor 12), `helmet` (CSP + HSTS), `express-rate-limit` (100 req/min authenticated, 20 req/min anonymous), an HTTPS-redirect middleware in production, React Email + Resend (transactional email), `swagger-ui-express` serving a hand-written OpenAPI 3.0 spec at `/api/docs`, Vitest + Supertest for tests (with `@vitest/coverage-v8`)
**CI** — GitHub Actions (`.github/workflows/ci.yml`): lint + typecheck + test for the server (against a real Postgres service container), lint + typecheck + build for the client, on every branch push

## Project structure

```
Hakikisha/
├── client/                    React SPA
│   └── src/
│       ├── api/                  Axios client + typed API calls (auth.ts, medicines.ts, scans.ts, reports.ts, csrf.ts, client.ts)
│       ├── components/            AuthNav.tsx (nav + admin unread-reports badge), PharmacyMap.tsx (Leaflet map), ProtectedRoute.tsx
│       ├── context/                AuthContext (login/logout/session state)
│       ├── hooks/                   useAuth
│       ├── pages/                    Route-level components (see "Client routes" below)
│       ├── types/                     Shared TS types (auth.ts, medicine.ts, scan.ts, report.ts)
│       └── utils/                     zxingFileDecoder.ts (photo-upload barcode decoding), html5QrcodeConfig.ts (live camera config), passwordPolicy.ts
├── server/                   Express API
│   ├── src/
│   │   ├── db/                  pool.ts, schema.sql, migrate.ts, seed.ts, reset.ts
│   │   ├── docs/                  openapiSpec.ts — hand-written OpenAPI 3.0 spec served at /api/docs
│   │   ├── emails/                React Email templates: VerifyEmailAddress.tsx, ReportAlertEmail.tsx
│   │   ├── lib/                    tokens.ts, cookies.ts, email.tsx, passwordPolicy.ts, pharmacyHours.ts (opening-hours parser)
│   │   ├── middleware/              auth.ts (httpOnly-cookie JWT verification, admin gate), csrf.ts (double-submit check), rateLimiter.ts
│   │   ├── routes/                   auth.ts, medicines.ts, pharmacies.ts, scans.ts, reports.ts (+ a co-located *.test.ts per file)
│   │   ├── services/                  barcodeLookup.ts (shared barcode → medicine/batch/scan-log lookup)
│   │   ├── types/                      express.d.ts (Request.user augmentation)
│   │   ├── app.ts                       Express app wiring (CORS, cookies, helmet, rate limiting, CSRF, /api/docs, routers, error handler)
│   │   └── index.ts                      Entry point
│   ├── vitest.config.ts         Coverage config (v8 provider, excludes db/seed|reset|migrate, emails/, index.ts)
│   └── postman/                 hakikisha-new-endpoints.postman_collection.json
└── .github/workflows/ci.yml   CI pipeline (see "CI" below)
```

## Getting started

### Prerequisites
- Node.js 20+
- A local PostgreSQL instance with the `pgcrypto` extension available

### Server setup

1. `cd server && npm install`
2. Create `server/.env` with:
   ```
   PORT=5000
   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/hakikisha_db
   JWT_SECRET=<a long random string>
   JWT_EXPIRES_IN=1h
   CLIENT_URL=http://localhost:5173

   # Leave unset for local dev (cookies use SameSite=Lax without Secure, which
   # works over http://localhost). Set NODE_ENV=production in real deployments
   # — it switches auth cookies to Secure + SameSite=None (required for the
   # cross-origin client/server split) and turns on the HTTPS-redirect middleware.
   # NODE_ENV=production

   # Transactional email (verification + counterfeit-report alerts). Sending
   # is best-effort everywhere it's used — a Resend failure never blocks
   # registration or report submission, it's only logged.
   RESEND_EMAIL_API_KEY=<your Resend API key>
   EMAIL_FROM="Hakikisha <onboarding@resend.dev>"   # optional — defaults to Resend's sandbox sender
   API_BASE_URL=http://localhost:5000                # optional — used to build the verify-email link
   ```
3. Create the database, then apply the schema:
   - **Brand-new, empty database:** `psql -d hakikisha_db -f src/db/schema.sql`
   - **Existing database from an earlier version of this app:** `npm run db:migrate` instead — applies only what's missing, safely re-runnable.
4. Seed sample data (medicines, reference photos, verification checklists, pharmacies with opening hours, health authorities): `npm run db:seed`
5. Run the API: `npm run dev` (nodemon + ts-node, watches `src/`)

### Client setup

1. `cd client && npm install`
2. (Optional) create `client/.env` with `VITE_API_URL=http://localhost:5000` if the API isn't on the default `http://localhost:5000`
3. `npm run dev`

### Tests & checks

- Server tests: `cd server && npm test` (Vitest + Supertest — `app.test.ts` plus a `*.test.ts` alongside every route/lib file: `routes/auth.ts`, `routes/medicines.ts`, `routes/pharmacies.ts`, `routes/scans.ts`, `routes/reports.ts`, `services/barcodeLookup.ts`, `middleware/csrf.ts`, `lib/passwordPolicy.ts`, `lib/pharmacyHours.ts`)
- Server coverage: `cd server && npm run test:coverage` (`@vitest/coverage-v8`, text + HTML report in `server/coverage/`) — overall line coverage is currently in the low-80s%, with every route file and service at 80%+ except `auth.ts`/`app.ts`/`tokens.ts` (68/63/63%, mostly less-critical branches like the HTML verify-email page and refresh-token edge cases)
- Server typecheck: `cd server && npx tsc --noEmit`
- Server lint: `cd server && npx eslint src --max-warnings 0`
- Client typecheck: `cd client && npx tsc --noEmit` (or `npx tsc -b`)
- Client lint: `cd client && npx eslint src --max-warnings 0`
- Client build: `cd client && npm run build`

### API documentation

`GET /api/docs` serves a Swagger UI over a hand-written OpenAPI 3.0 spec (`server/src/docs/openapiSpec.ts`) covering every endpoint below — request/response bodies, query params, auth requirements, and status codes. It's a plain object (not JSDoc-scanned from route comments), kept in sync by hand alongside route changes; with ~18 endpoints across 5 route files this stays simpler than annotating every route for a scanner to parse. It's GET-only and left reachable in production (untouched by CSRF, which only checks mutating methods).

### CI

`.github/workflows/ci.yml` runs on every branch push, as two independent jobs:

- **Server** — spins up a real `postgres:15` service container, installs deps, typechecks, lints (`eslint src --max-warnings 0` — zero tolerance, warnings fail the build), applies `schema.sql` against the fresh test database, then runs the test suite.
- **Client** — installs deps, typechecks, lints (same zero-warning policy), then runs a production build (`VITE_API_URL` pointed at a dummy value since no server is running in this job).

Because lint runs with `--max-warnings 0`, any ESLint warning (not just errors) fails CI — including newer `eslint-plugin-react-hooks` rules like `react-hooks/set-state-in-effect`, which flags calling a state setter synchronously at the top of an Effect body. Where that's come up, the fix used in this codebase is to move the "reset state in response to a prop/state change" logic out of the Effect and into a render-time comparison against a tracked "previous value" state (React's documented pattern for adjusting state — see `AdminReportsPage.tsx`, `DashboardPage.tsx`, `BarcodeScanPage.tsx`), keeping the Effect itself limited to the actual external-system work (the fetch, the timer).

## Security

- **Passwords** — hashed with `bcryptjs` at cost factor 12; both registration and password-change enforce a shared complexity rule (8+ characters, at least one uppercase, one lowercase, and one digit — `server/src/lib/passwordPolicy.ts`, mirrored client-side in `client/src/utils/passwordPolicy.ts` with a live checklist on the registration form).
- **Auth cookies** — access token (1h), refresh token (30 days if "remember me", session-only otherwise), and a CSRF token are all set as httpOnly (access/refresh) or readable (CSRF) cookies by `/login` and `/refresh`. Refresh rotates the token and revokes the old one; logout revokes both the current access token (by `jti`) and the refresh token.
- **CSRF** — double-submit cookie pattern (`server/src/middleware/csrf.ts`): every mutating request must echo the CSRF cookie's value back as an `X-CSRF-Token` header. The check only applies once an access-token cookie is present — an anonymous request (e.g. `POST /api/scans` from a never-logged-in visitor, which the app deliberately allows) has no session cookie for a cross-site request to ride on in the first place, so there's nothing for the double-submit check to protect there. `/register`, `/login`, and `/refresh` are unconditionally exempt for the same reason (no session cookie exists yet at that point). The client can't get the CSRF value by reading the cookie directly, since client and API are on different origins in production and a cookie only belongs to the origin that set it — `/login`, `/refresh`, and `/me` return the current value in their JSON body instead, which the client (`client/src/api/csrf.ts`) keeps in memory and resyncs from on page load/refresh.
- **Rate limiting** — `express-rate-limit`, keyed by user id when authenticated or by IP (IPv6-subnet-aware) otherwise: 100 req/min authenticated, 20 req/min anonymous.
- **Transport** — `helmet` sets a CSP (relaxed only for the two places that need inline `<style>`/`<script>`: the plain-HTML verify-email page and the Swagger UI docs page — both fixed, non-user-controlled content) plus the rest of helmet's default hardening headers; in production, a middleware redirects any non-HTTPS request (via `X-Forwarded-Proto`, since TLS terminates at the platform's proxy) before it reaches the app.

## Database schema

Defined in `server/src/db/schema.sql` (idempotent equivalent for existing databases in `server/src/db/migrate.ts`).

| Table | Purpose |
|---|---|
| `users` | Accounts. `role` is one of `admin`, `manufacturer`, `pharmacist`, `consumer`. `is_verified` is set by the email-verification link. `reports_last_viewed_at` backs the admin unread-reports badge. |
| `medicines` | One row per registered medicine/product: name, generic name, manufacturer, dosage form, strength, 8–13-digit EAN barcode, regulatory body, approval number/status (`approved`/`pending`/`rejected`/`expired`). |
| `batch_records` | Production batches of a medicine (batch number, manufacture/expiry dates, quantity, QR hash, status). Not seeded by `seed.ts` — see "Known limitations". |
| `scans` | One row per barcode lookup: which batch (if matched, nullable), the raw `barcode` scanned, who scanned it (nullable — scanning doesn't require login), the result (`authentic`/`expired`/`unknown`), and optional lat/lng. |
| `reports` | User-filed counterfeit reports, linked to either a `scan` or a free-text `product_name`. Carries `country` (routes the alert email), `purchase_location`, an optional `photo_url` (base64 data URL, interim), an `admin_notes` free-text field, and a status (`pending`/`investigating`/`escalated`/`resolved`/`dismissed`). |
| `medicine_photos` | Reference **tablet**/**package** photos per medicine (renamed from an earlier front/back scheme). A medicine can have either angle, both, or (rarely) neither — the UI only renders the angles actually on file. |
| `verification_checklist_items` | Backs the "How to Identify a Genuine Package" ✓ checklist in the scan flow via a `section` enum (`package_verification`; a second `safety_comparison` section still exists in the schema/API but is no longer rendered — see "The scan verification flow"). Ordered by `display_order`. |
| `pharmacies` | Pharmacy directory: name, address, latitude/longitude, phone, free-text `hours`. Seeded with 39 real Kigali, Rwanda pharmacies plus 7 earlier Nigeria/Kenya/South Africa demo entries (46 total) — see "Pharmacy data". |
| `pharmacy_medicine_stock` | Many-to-many: which pharmacies stock which medicines. Backs the "Confirmed in stock" flag/sort/filter throughout the pharmacy-facing UI. |
| `health_authorities` | One national medicines regulator per country (name + alert email). Used to route the counterfeit-report alert email. |
| `refresh_tokens` / `revoked_access_tokens` | JWT refresh-token rotation and access-token revocation (logout) bookkeeping. |

## API reference

Auth is required only where noted. The access token, refresh token, and a CSRF token are all set as cookies by `/login` and `/refresh` (access + refresh are `httpOnly`; the CSRF cookie isn't). Requests need `credentials: "include"` (or axios's `withCredentials: true`) to send them. Every *authenticated* mutating request (`POST`/`PATCH`/`PUT`/`DELETE`) must also send the CSRF cookie's value back as an `X-CSRF-Token` header, or it's rejected with 403 — see "Security" above for why anonymous mutating requests (e.g. an anonymous scan) are exempt. In production the client and API are on different origins, so `document.cookie` on the client's page can never actually see the CSRF cookie (cookies are only readable by scripts on the origin that set them, regardless of `SameSite`/`Secure`) — `/login`, `/refresh`, and `/me` all also return the current `csrfToken` value in their JSON body for this reason, and the client keeps that in memory rather than trying to read the cookie. The full request/response shape for every endpoint below is also browsable at `GET /api/docs`.

### Auth — `/api/auth`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/check-email` | query: `email` | Validates format and checks availability before a registration form is submitted. |
| POST | `/register` | `{ email, password, fullName, country, role? }` | Password must be 8+ characters with an upper/lowercase letter and a digit. `role` defaults to `consumer`; self-registration only allows `manufacturer`/`pharmacist`/`consumer`. Fires a best-effort verification email. |
| GET | `/verify-email` | query: `token` | Link target from the verification email; sets `is_verified = true`. Returns a small standalone HTML page, not JSON. |
| POST | `/login` | `{ email, password, remember? }` | Sets the access/refresh/CSRF cookies (`remember: true` makes the refresh/CSRF cookies persist 30 days instead of being session-only) and returns `{ user, csrfToken }`. |
| POST | `/refresh` | — (reads the refresh cookie) | Rotates the refresh token (old one revoked) and re-sets all three cookies, carrying the original `remember` choice forward. Returns `{ csrfToken }` (200, not 204 — the body is needed). |
| POST | `/logout` | — (auth required, reads the refresh cookie) | Revokes the current access token (by `jti`) and the refresh token, and clears all three cookies. |
| GET | `/me` | — (auth required) | Returns `{ user, csrfToken }` — the current user, plus the current CSRF token so the client can resync it on page load. |
| PATCH | `/me` | `{ fullName }` (auth required) | Updates display name. |
| POST | `/change-password` | `{ currentPassword, newPassword }` (auth required) | Same complexity rule as registration. Revokes all other active sessions on success. |

### Medicines — `/api/medicines`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/search` | query: `q`, `page?` | ILIKE match against `name`/`generic_name`, paginated 10/page. |
| GET | `/barcode/:barcode` | path: `barcode` (8–13 digits); query: `lat?`, `lng?` | Looks up a medicine by barcode + its latest batch and logs a `scans` row. Superseded as the scan flow's primary entry point by `POST /api/scans` below, but still available. |
| GET | `/:id` | path: `id` (UUID) | Full medicine record by id. |
| GET | `/:id/verification` | path: `id` (UUID) | Returns `{ medicine, photos: { tablet, package }, packageVerification: string[], safetyComparison: string[] }`. Either photo key can be `null` if that angle isn't on file for this medicine. |

### Scans — `/api/scans`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/` | `{ barcode, lat?, lng? }` (optional auth — attributes the scan if logged in) | The scan flow's actual entry point. Returns `{ status: "VERIFIED"\|"UNVERIFIED", scanId, medicine, batchNumber, expiryDate, message? }`. `message` is status-specific ("awaiting regulatory approval", "registration was rejected...", "regulatory approval has expired", "This batch has expired.") rather than one generic string. |
| GET | `/my` | — (auth required) | Scan history for the logged-in user: `{ id, barcode, medicineId, medicineName, result, scannedAt }[]`. Resolves the medicine by matching `scans.barcode` against `medicines.barcode` (not via `batch_record_id`), so history still resolves correctly even for medicines with no batch record on file. |

### Pharmacies — `/api/pharmacies`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/nearby` | query: `lat`, `lng` (required), `radiusKm?` (default 10), `medicineId?` (UUID), `openNow?` (`"true"`) | Returns pharmacies within `radiusKm`, sorted with `medicineId`-stocking pharmacies first (then nearest-first). Each result includes a computed `distanceKm`, a `stocksMedicine: boolean \| null` flag (`null` when `medicineId` wasn't passed — it's a flag/sort key, not a hard filter here), and an `isOpenNow: boolean \| null` flag parsed from the pharmacy's free-text `hours` (`null` when hours are missing/unparseable — treated as unknown, never guessed at). Passing `openNow=true` filters the result set down to `isOpenNow === true` only. Distance is plain Haversine math in the SQL query (no PostGIS). |

### Reports — `/api/reports`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/` | `{ scanId? \| productName?, description, country, purchaseLocation?, photoUrl? }` (auth required) | Requires either `scanId` or `productName`. Fires a best-effort alert email to the `health_authorities` row matching `country` (never blocks the response — failures are only logged). |
| GET | `/my` | — (auth required) | The logged-in user's own filed reports (summary shape — `hasPhoto: boolean` instead of the full photo). |
| GET | `/` | query: `page?`, `status?` (one of the 5 statuses), `sort?` (`"newest"` default \| `"oldest"`) (auth + admin required) | Paginated (20/page) reports with reporter identity and (for scan-linked reports) the resolved medicine name. Opening this endpoint also marks this admin's reports as viewed, clearing their unread-count badge. |
| GET | `/unread-count` | — (auth + admin required) | `{ count }` — reports filed since this admin last opened the list above. Backs the badge next to "Admin Reports" in the nav. |
| PATCH | `/:id` | `{ action?: "review"\|"escalate"\|"approve"\|"dismiss", notes? }` (auth + admin required, at least one of `action`/`notes` required) | `review`→`investigating`, `escalate`→`escalated` (non-terminal — no `resolved_by`/`resolved_at` stamped). `approve`→`resolved`, `dismiss`→`dismissed` (terminal — both stamp `resolved_by`/`resolved_at`). `notes` updates `admin_notes` independently of any status change. |

A ready-to-import Postman collection covering the medicines/pharmacies endpoints lives at `server/postman/hakikisha-new-endpoints.postman_collection.json` (a subset of what `/api/docs` now covers in full).

## Client routes

| Path | Page | Auth |
|---|---|---|
| `/` | `HomePage` — landing page (`LandingPage`) if logged out, a simple in-app home with nav links (+ admin link for admins) if logged in | Public |
| `/login`, `/register` | `LoginPage`, `RegisterPage` (live password-requirements checklist) | Public |
| `/logout` | `LogoutPage` | Public (renders its confirm/done state even if the session already expired) |
| `/barcode` | `BarcodeScanPage` — the scan wizard | Public (optionally attributes the scan if logged in) |
| `/search` | `SearchPage` | Public |
| `/medicines/:id` | `MedicineDetailPage` — full medicine record, plus its own "Find pharmacies stocking this medicine" map/list section | Public |
| `/pharmacy` | `PharmacyMapPage` — dedicated pharmacy map: search a medicine, share/skip location, then see only open, in-stock pharmacies by default (with a "closed but in stock" reveal option) | Protected |
| `/report` | `ReportCounterfeitPage` | Protected |
| `/admin/reports` | `AdminReportsPage` — paginated report queue with status filter/sort, per-report notes, and review/escalate/approve/dismiss actions | Protected (admin) |
| `/dashboard` | `DashboardPage` — scan history (links to the matched medicine), report history, display name + password change, logout | Protected |

## The scan verification flow

`client/src/pages/BarcodeScanPage.tsx` drives a five-step wizard. The step indicator across the top is a real tab bar — every step is clickable once a medicine has been identified, so users aren't locked into moving forward only.

1. **Scan** — camera (via `html5-qrcode`), photo upload (via `zxing-wasm`), or manual entry — all funnel into `POST /api/scans`. The camera view shows a running "Scanning... Xs" timer and, if nothing's found within ~6 seconds, a plain-language repositioning tip; after 25 seconds it stops and shows a clear "scan failed" message (not fully in frame / too far / glare) with a one-tap retry, rather than leaving the user staring at an unresponsive viewfinder.
2. **Medicine identified** — shows the matched medicine, batch, expiry date, and a status-specific message (approved/pending/rejected/expired-approval, or batch-expired), plus a "View full details" link to `/medicines/:id`.
3. **Reference photos** — fetches `GET /api/medicines/:id/verification` and shows whichever of the tablet/package reference photos are on file for this medicine (not every medicine has both).
4. **Package verification** — "How to Identify a Genuine Package": a static ✓ checklist from `packageVerification`.
5. **Nearby pharmacy** — requests browser geolocation, then calls `GET /api/pharmacies/nearby` with the identified medicine's id and renders a Leaflet map plus a list of only the pharmacies confirmed to stock it, nearest-first. Each map marker's popup shows the pharmacy's name, "Confirmed in stock" badge, address, phone, distance, opening hours, an open/closed tag, and a **Navigate** link that deep-links to Google Maps directions.

If the barcode isn't found, the flow stops at step 1 with an "Unknown Product" message (not necessarily counterfeit — just not in the database).

The same nearby-pharmacy lookup is also available from two other entry points: `MedicineDetailPage` (reached via `/search`) has its own "Find pharmacies stocking this medicine" section, and the dedicated `/pharmacy` page lets a user search any medicine directly without having scanned anything first.

## Pharmacy data

The `pharmacies` table is seeded (via `server/src/db/seed.ts`) with **39 real pharmacies in Kigali, Rwanda** — names and neighborhoods sourced from Rwanda FDA's licensed-retail-pharmacy lists and public directories (rwandayp.com, vinepharmacy.rw, pharmacieconseil.org), covering all three Kigali districts (Gasabo, Kicukiro, Nyarugenge), plus 7 earlier Nigeria/Kenya/South Africa demo entries (46 pharmacies total). Coordinates are neighborhood-level approximations (not surveyed GPS pins) — good enough for the map visualization and Google Maps navigation, but worth spot-checking before treating them as production-accurate. Every seeded pharmacy has a placeholder-but-parseable `hours` string (e.g. `"Mon-Sat 08:00-20:00"`, `"Daily 07:00-22:00"`), parsed by `server/src/lib/pharmacyHours.ts` (Africa/Kigali local time, no DST to worry about) to power the open-now flag/filter — this is deliberately placeholder data, not scraped real hours.

Each Kigali pharmacy stocks a deterministic, reproducible subset (roughly 15–80% depending on the pharmacy) of the medicine catalogue, rather than either "every pharmacy stocks everything" or true randomness — computed from a hash of the pharmacy and medicine ids (`djb2Hash`/`pharmacyStocksMedicine` in `seed.ts`), so reseeding produces the same stock pattern every time without needing to persist it separately. Since most seeded medicines are regulated by NAFDAC/KEBS/SAHPRA rather than a Rwandan body, Kigali pharmacies draw from the full catalogue rather than one country's slice of it (`COUNTRY_TO_REGULATORS` maps Rwanda to all four regulators, including Rwanda FDA now that at least one medicine — Gamalate B6 — is Rwanda-FDA-approved) — realistic for a market that imports rather than manufactures most of its registered medicines.

The map itself (`client/src/components/PharmacyMap.tsx`) uses Leaflet + React-Leaflet with OpenStreetMap tiles — no API key required.

## Medicine photos

`medicine_photos` now holds real product photography for most of the 32 seeded medicines (uploaded and sorted by filename convention: `p_` = package-only, `t_` = tablet-only, `p+t_` = a single combined shot, filed under the package angle) rather than generated placeholders — currently 28 medicines have a package photo and 11 have a tablet photo on file, with the verification-flow UI only rendering whichever angles actually exist for a given medicine (see "The scan verification flow", step 3). A few medicines still have no photo on file at all and show a "not yet available" message instead.

## Email flows

Two transactional emails, both sent via Resend (`server/src/lib/email.tsx`) using React Email templates (`server/src/emails/`), and both **best-effort** — a send failure is logged but never blocks the underlying action:

- **`VerifyEmailAddress`** — sent on registration; the link hits `GET /api/auth/verify-email?token=...` (a JWT-based token, no separate DB table needed) and sets `users.is_verified = true`.
- **`ReportAlertEmail`** — sent on `POST /api/reports`, to whichever `health_authorities` row matches the report's `country`. Shows the reporter's country, product name, description, and date filed.

## Known limitations / next steps

- **Reference photos aren't complete or professionally shot.** Real product photography now covers most (not all) of the 32 seeded medicines — a handful still show no photo at all, and image quality/resolution varies since these are handheld/found photos rather than studio shots.
- **Checklist text is generic, not per-product.** `packageVerification` items are dosage-form-aware but generic rather than describing a specific product's actual packaging. A second checklist section (`safety_comparison`) still exists in the schema/API but is no longer surfaced in the UI (removed as a usability simplification — see "The scan verification flow").
- **No meaningful batch data seeded.** `batch_records` isn't populated by `seed.ts`, so `batchNumber`/`expiryDate` on a scan result are `null` for essentially every seeded medicine even on a "VERIFIED" match — the fields and UI are wired correctly, they just have nothing to show yet. (One manually-inserted test row exists outside the seed script, for a "Testolin" medicine that isn't part of `seed.ts` either — both are leftover test artifacts worth cleaning up before a real deployment.)
- **Pharmacy coverage is Kigali-only.** Real, curated data exists for Kigali; the rest of Rwanda (and the earlier Nigeria/Kenya/South Africa entries) aren't comparably covered. Expanding coverage further would mean either hand-curating more real entries or scraping/geocoding Rwanda FDA's periodically-reissued PDF pharmacy lists.
- **Opening hours are placeholder data.** Parseable and consistent, but not scraped from each pharmacy's actual real-world hours.
- **No single-pharmacy detail endpoint.** Only `GET /api/pharmacies/nearby` (a list) exists — deliberate, since every place that shows pharmacy details (map popup, list card) only ever needed the fields `/nearby` already returns.
- **No auth on medicine/pharmacy/scan-submission routes.** By design, so scanning and searching work for anonymous users — `scanned_by` on a `scans` row is only populated if a valid access-token cookie happens to be present.
- **No versioned migration tooling.** `schema.sql` is a single hand-maintained file for brand-new databases. `server/src/db/migrate.ts` covers everything added after the original schema (idempotent — safe to run against a database that already has some, none, or all of it) but there's no framework tracking which migrations have run where; every future schema change needs a new idempotent statement added there by hand.
- **Report photos are base64 data URLs.** Interim storage (`reports.photo_url` is `TEXT`) until real object storage (Railway volume / S3 / etc.) is wired in.
- **Rate limiting is per-process.** `express-rate-limit`'s default in-memory store resets on restart and isn't shared across instances — fine for a single-instance deployment, would need `rate-limit-redis` (or similar) to scale horizontally.
- **CSP/X-Frame-Options for the frontend itself aren't set here.** `helmet` on the Express app only covers API responses (plus the verify-email and Swagger docs HTML pages); headers for the React SPA the browser actually renders need to be configured at whatever static host serves `client/` (e.g. a `vercel.json`/`netlify.toml` headers block).
- **The site logo carries a template watermark.** `client/public/assets/hakikisha-logo.png` (used in the nav, footer, landing page, and favicon) is a placeholder with a faint tiled watermark from the template it was generated from — needs replacing with a real, licensed logo before a real deployment.
- **A number of leftover test/debug user accounts exist** in dev/staging databases from manual testing during development — worth clearing out before onboarding real users.

## Removed: OpenFDA integration

An earlier iteration of the search feature pulled live drug label/approval/adverse-event data from the public OpenFDA API (`api.fda.gov`). It was removed in favor of the local, curated verification flow described above — there is no OpenFDA-dependent code left in the codebase.
