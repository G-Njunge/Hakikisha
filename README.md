# Hakikisha

Hakikisha ("assurance" / "make certain" in Swahili) is a medicine authenticity verification tool. Consumers scan a medicine's barcode (or search by name) and are walked through a guided flow to confirm the product is genuine: the medicine is identified against a local registry, matched against reference packaging photos, checked against a genuine-package checklist and a side-by-side comparison checklist, and finally pointed to nearby pharmacies — visualized on a map — that stock it. Suspicious products can be reported, which alerts the relevant national medicines regulator by email.

## Tech stack

**Client** — React 19 + TypeScript, Vite, React Router 7, Axios, Leaflet + React-Leaflet (map), html5-qrcode (camera/photo barcode scanning)
**Server** — Node.js, Express 5 + TypeScript, PostgreSQL (`pg`), JWT auth (`jsonwebtoken`) stored in httpOnly cookies with refresh-token rotation and double-submit CSRF protection, `bcryptjs`, `helmet`, `express-rate-limit`, React Email + Resend (transactional email), Vitest + Supertest for tests
**CI** — GitHub Actions (`.github/workflows/ci.yml`): lint + typecheck + test for the server (against a real Postgres service container), lint + typecheck + build for the client, on every branch push

## Project structure

```
Hakikisha/
├── client/                    React SPA
│   └── src/
│       ├── api/                  Axios client + typed API calls (auth.ts, medicines.ts, scans.ts, reports.ts, client.ts)
│       ├── components/            PharmacyMap.tsx (Leaflet map), ProtectedRoute.tsx (auth-gated routes)
│       ├── context/                AuthContext (login/logout/session state)
│       ├── hooks/                   useAuth
│       ├── pages/                    Route-level components (see "Client routes" below)
│       └── types/                     Shared TS types (medicine.ts, scan.ts, report.ts)
├── server/                   Express API
│   ├── src/
│   │   ├── db/                  pool.ts, schema.sql, migrate.ts, seed.ts, reset.ts
│   │   ├── emails/                React Email templates: VerifyEmailAddress.tsx, ReportAlertEmail.tsx
│   │   ├── lib/                    tokens.ts (JWT + refresh/verification token helpers), cookies.ts (auth/CSRF cookie set/clear), email.tsx (Resend sending)
│   │   ├── middleware/              auth.ts (httpOnly-cookie JWT verification, admin gate), csrf.ts (double-submit check), rateLimiter.ts
│   │   ├── routes/                   auth.ts, medicines.ts, pharmacies.ts, scans.ts, reports.ts
│   │   ├── services/                  barcodeLookup.ts (shared barcode → medicine/batch/scan-log lookup)
│   │   ├── types/                      express.d.ts (Request.user augmentation)
│   │   ├── app.ts                       Express app wiring (CORS, cookies, helmet, rate limiting, CSRF, routers, error handler)
│   │   └── index.ts                      Entry point
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
4. Seed sample data (medicines, reference photos, verification checklists, pharmacies, health authorities): `npm run db:seed`
5. Run the API: `npm run dev` (nodemon + ts-node, watches `src/`)

### Client setup

1. `cd client && npm install`
2. (Optional) create `client/.env` with `VITE_API_URL=http://localhost:5000` if the API isn't on the default `http://localhost:5000`
3. `npm run dev`

### Tests & checks

- Server tests: `cd server && npm test` (Vitest + Supertest, `src/app.test.ts`)
- Server typecheck: `cd server && npx tsc --noEmit`
- Server lint: `cd server && npx eslint src --max-warnings 0`
- Client typecheck: `cd client && npx tsc --noEmit` (or `npx tsc -b`)
- Client lint: `cd client && npx eslint src --max-warnings 0`
- Client build: `cd client && npm run build`

### CI

`.github/workflows/ci.yml` runs on every branch push, as two independent jobs:

- **Server** — spins up a real `postgres:15` service container, installs deps, typechecks, lints (`eslint src --max-warnings 0` — zero tolerance, warnings fail the build), applies `schema.sql` against the fresh test database, then runs the test suite.
- **Client** — installs deps, typechecks, lints (same zero-warning policy), then runs a production build (`VITE_API_URL` pointed at a dummy value since no server is running in this job).

Because lint runs with `--max-warnings 0`, any ESLint warning (not just errors) fails CI — including newer `eslint-plugin-react-hooks` rules like `react-hooks/set-state-in-effect`, which flags calling a state setter synchronously at the top of an Effect body. Where that's come up, the fix used in this codebase is to move the "reset state in response to a prop/state change" logic out of the Effect and into a render-time comparison against a tracked "previous value" state (React's documented pattern for adjusting state — see `AdminReportsPage.tsx`, `DashboardPage.tsx`, `BarcodeScanPage.tsx`), keeping the Effect itself limited to the actual external-system work (the fetch, the timer).

## Database schema

Defined in `server/src/db/schema.sql` (idempotent equivalent for existing databases in `server/src/db/migrate.ts`).

| Table | Purpose |
|---|---|
| `users` | Accounts. `role` is one of `admin`, `manufacturer`, `pharmacist`, `consumer`. `is_verified` is set by the email-verification link. |
| `medicines` | One row per registered medicine/product: name, generic name, manufacturer, dosage form, strength, 8–13-digit EAN barcode, regulatory body, approval number/status (`approved`/`pending`/`rejected`/`expired`). |
| `batch_records` | Production batches of a medicine (batch number, manufacture/expiry dates, quantity, QR hash, status). |
| `scans` | One row per barcode lookup: which batch (if matched, nullable), the raw `barcode` scanned, who scanned it (nullable — scanning doesn't require login), the result (`authentic`/`counterfeit`/`expired`/`unknown`), and optional lat/lng. |
| `reports` | User-filed counterfeit reports, linked to either a `scan` or a free-text `product_name`. Carries `country` (routes the alert email), `purchase_location`, an optional `photo_url` (base64 data URL, interim), and a status (`pending`/`investigating`/`resolved`/`dismissed`). |
| `medicine_photos` | Reference **front**/**back** packaging photos per medicine. |
| `verification_checklist_items` | Backs *both* checklists in the scan flow via a `section` enum: `package_verification` (the "How to Identify a Genuine Package" ✓ list) and `safety_comparison` (the "Things to Compare" ☐ list). Ordered by `display_order`. |
| `pharmacies` | Pharmacy directory: name, address, latitude/longitude, phone. Currently seeded with 39 real Kigali, Rwanda pharmacies plus a handful of Nigeria/Kenya/South Africa demo entries (see "Pharmacy data" below). |
| `pharmacy_medicine_stock` | Many-to-many: which pharmacies stock which medicines. Backs the "Confirmed in stock" flag/sort on the nearby-pharmacy step. |
| `health_authorities` | One national medicines regulator per country (name + alert email). Used to route the counterfeit-report alert email. |
| `refresh_tokens` / `revoked_access_tokens` | JWT refresh-token rotation and access-token revocation (logout) bookkeeping. |

## API reference

Auth is required only where noted. The access token, refresh token, and a CSRF token are all set as cookies by `/login` and `/refresh` (access + refresh are `httpOnly`; the CSRF cookie isn't, since the client needs to read it and echo it back). Requests need `credentials: "include"` (or axios's `withCredentials: true`) to send them. Every mutating request (`POST`/`PATCH`/`PUT`/`DELETE`) other than `/register`, `/login`, and `/refresh` must also send the CSRF cookie's value back as an `X-CSRF-Token` header, or it's rejected with 403.

### Auth — `/api/auth`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/check-email` | query: `email` | Validates format and checks availability before a registration form is submitted. |
| POST | `/register` | `{ email, password, fullName, country, role? }` | `role` defaults to `consumer`; self-registration only allows `manufacturer`/`pharmacist`/`consumer`. Fires a best-effort verification email. |
| GET | `/verify-email` | query: `token` | Link target from the verification email; sets `is_verified = true`. Returns a small standalone HTML page, not JSON. |
| POST | `/login` | `{ email, password, remember? }` | Sets the access/refresh/CSRF cookies (`remember: true` makes the refresh/CSRF cookies persist 30 days instead of being session-only) and returns `{ user }`. |
| POST | `/refresh` | — (reads the refresh cookie) | Rotates the refresh token (old one revoked) and re-sets all three cookies, carrying the original `remember` choice forward. |
| POST | `/logout` | — (auth required, reads the refresh cookie) | Revokes the current access token (by `jti`) and the refresh token, and clears all three cookies. |
| GET | `/me` | — (auth required) | Returns the current user. |
| PATCH | `/me` | `{ fullName }` (auth required) | Updates display name. |
| POST | `/change-password` | `{ currentPassword, newPassword }` (auth required) | — |

### Medicines — `/api/medicines`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/search` | query: `q`, `page?` | ILIKE match against `name`/`generic_name`, paginated 10/page. |
| GET | `/barcode/:barcode` | path: `barcode` (8–13 digits); query: `lat?`, `lng?` | Looks up a medicine by barcode + its latest batch and logs a `scans` row. Superseded as the scan flow's primary entry point by `POST /api/scans` below, but still available. |
| GET | `/:id` | path: `id` (UUID) | Full medicine record by id. |
| GET | `/:id/verification` | path: `id` (UUID) | Returns `{ medicine, photos: { front, back }, packageVerification: string[], safetyComparison: string[] }` — everything the scan flow needs after a medicine is identified. |

### Scans — `/api/scans`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/` | `{ barcode, lat?, lng? }` (optional auth — attributes the scan if logged in) | The scan flow's actual entry point. Returns `{ status: "VERIFIED"\|"UNVERIFIED", scanId, medicine, batchNumber, expiryDate, message? }`. `message` is status-specific ("awaiting regulatory approval", "registration was rejected...", "regulatory approval has expired", "This batch has expired.") rather than one generic string. |
| GET | `/my` | — (auth required) | Scan history for the logged-in user: `{ id, barcode, medicineId, medicineName, result, scannedAt }[]`. Resolves the medicine by matching `scans.barcode` against `medicines.barcode` (not via `batch_record_id`), so history still resolves correctly even for medicines with no batch record on file. |

### Pharmacies — `/api/pharmacies`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/nearby` | query: `lat`, `lng` (required), `radiusKm?` (default 10), `medicineId?` (UUID) | Returns pharmacies within `radiusKm`, sorted with `medicineId`-stocking pharmacies first (then nearest-first), each with a computed `distanceKm` and a `stocksMedicine: boolean \| null` flag (`null` when `medicineId` wasn't passed — it's a flag/sort key, not a hard filter, so a pharmacy with no confirmed stock still shows up). Distance is plain Haversine math in the SQL query (no PostGIS). |

### Reports — `/api/reports`
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/` | `{ scanId? \| productName?, description, country, purchaseLocation?, photoUrl? }` (auth required) | Requires either `scanId` or `productName`. Fires a best-effort alert email to the `health_authorities` row matching `country` (never blocks the response — failures are only logged). |
| GET | `/my` | — (auth required) | The logged-in user's own filed reports. |
| GET | `/` | query: `page?` (auth + admin required) | Paginated (20/page), all reports, with reporter identity and (for scan-linked reports) the resolved medicine name. |
| PATCH | `/:id` | `{ action: "approve" \| "dismiss" }` (auth + admin required) | Sets status to `resolved` or `dismissed`. |

A ready-to-import Postman collection covering the medicines/pharmacies endpoints lives at `server/postman/hakikisha-new-endpoints.postman_collection.json`.

## Client routes

| Path | Page | Auth |
|---|---|---|
| `/` | `HomePage` — landing page (`LandingPage`) if logged out, a simple in-app home with nav links (+ admin link for admins) if logged in | Public |
| `/login`, `/register` | `LoginPage`, `RegisterPage` | Public |
| `/barcode` | `BarcodeScanPage` — the six-step scan wizard | Public (optionally attributes the scan if logged in) |
| `/search` | `SearchPage` | Public |
| `/medicines/:id` | `MedicineDetailPage` — full medicine record, plus its own "Find pharmacies stocking this medicine" map/list section | Public |
| `/report` | `ReportCounterfeitPage` | Protected |
| `/admin/reports` | `AdminReportsPage` — paginated report queue, approve/dismiss actions | Protected (admin) |
| `/dashboard` | `DashboardPage` — scan history (links to the matched medicine), report history, display name + password change, logout | Protected |

## The scan verification flow

`client/src/pages/BarcodeScanPage.tsx` drives a six-step wizard, with a progress indicator across the top:

1. **Scan** — camera (via `html5-qrcode`), manual entry, photo upload, or a fallback search-by-name — all funnel into `POST /api/scans`.
2. **Medicine identified** — shows the matched medicine, batch, expiry date, and a status-specific message (approved/pending/rejected/expired-approval, or batch-expired) — plus a "View full details" link to `/medicines/:id` and a "Report this as counterfeit" link.
3. **Reference photos** — fetches `GET /api/medicines/:id/verification` and shows the front/back reference images.
4. **Package verification** — "How to Identify a Genuine Package": a static ✓ checklist from `packageVerification`.
5. **Safety information** — "Things to Compare": an interactive ☐ checklist (local state only, not persisted) from `safetyComparison`.
6. **Nearby pharmacy** — requests browser geolocation, then calls `GET /api/pharmacies/nearby` with the identified medicine's id and renders a Leaflet map plus a list, both sorted with confirmed-stock pharmacies first. Each map marker's popup shows the pharmacy's name, "Confirmed in stock" badge (if applicable), address, phone, distance, and a **Navigate** link that deep-links to Google Maps directions.

If the barcode isn't found, the flow stops at step 1 with an "Unknown Product" message (not necessarily counterfeit — just not in the database).

The same nearby-pharmacy map is also available from the **Search** path: `MedicineDetailPage` (reached via `/search`) has its own "Find pharmacies stocking this medicine" section, so both entry points converge on the same pharmacy-lookup experience.

## Pharmacy data

The `pharmacies` table is seeded (via `server/src/db/seed.ts`) with **39 real pharmacies in Kigali, Rwanda** — names and neighborhoods sourced from Rwanda FDA's licensed-retail-pharmacy lists and public directories (rwandayp.com, vinepharmacy.rw, pharmacieconseil.org), covering all three Kigali districts (Gasabo, Kicukiro, Nyarugenge), plus a handful of earlier Nigeria/Kenya/South Africa demo entries. Coordinates are neighborhood-level approximations (not surveyed GPS pins) — good enough for the map visualization and Google Maps navigation, but worth spot-checking before treating them as production-accurate.

Since none of the seeded medicines have a Rwandan regulatory body (only NAFDAC/KEBS/SAHPRA exist in the demo data), Kigali pharmacies are modeled as stocking the full medicine catalogue rather than one country's slice of it (`COUNTRY_TO_REGULATORS` in `seed.ts` maps Rwanda to all three regulators) — realistic for a market that imports rather than manufactures most of its registered medicines, and it keeps the "Confirmed in stock" feature meaningful without inventing a fourth regulator.

The map itself (`client/src/components/PharmacyMap.tsx`) uses Leaflet + React-Leaflet with OpenStreetMap tiles — no API key required.

## Email flows

Two transactional emails, both sent via Resend (`server/src/lib/email.tsx`) using React Email templates (`server/src/emails/`), and both **best-effort** — a send failure is logged but never blocks the underlying action:

- **`VerifyEmailAddress`** — sent on registration; the link hits `GET /api/auth/verify-email?token=...` (a JWT-based token, no separate DB table needed) and sets `users.is_verified = true`.
- **`ReportAlertEmail`** — sent on `POST /api/reports`, to whichever `health_authorities` row matches the report's `country`. Shows the reporter's country, product name, description, and date filed.

## Known limitations / next steps

- **Reference photos are placeholders.** Seed data points `medicine_photos` at generated placeholder images (`placehold.co`), not real product photography.
- **Checklist text is generic, not per-product.** `packageVerification` items are dosage-form-aware but generic rather than describing a specific product's actual packaging. `safetyComparison` is the same fixed 5-item list for every medicine.
- **No batch data seeded.** `batch_records` has no seed rows, so `batchNumber`/`expiryDate` on a scan result are always `null` in this demo even for a "VERIFIED" match — the fields and UI are wired correctly, they just have nothing to show yet.
- **Pharmacy coverage is Kigali-only.** Real, curated data exists for Kigali; the rest of Rwanda (and the earlier Nigeria/Kenya/South Africa entries) aren't comparably covered. Expanding coverage further would mean either hand-curating more real entries or scraping/geocoding Rwanda FDA's periodically-reissued PDF pharmacy lists.
- **No single-pharmacy detail endpoint.** Only `GET /api/pharmacies/nearby` (a list) exists — deliberate, since every place that shows pharmacy details (map popup, list card) only ever needed the fields `/nearby` already returns.
- **No auth on medicine/pharmacy/scan-submission routes.** By design, so scanning and searching work for anonymous users — `scanned_by` on a `scans` row is only populated if a valid access-token cookie happens to be present.
- **No versioned migration tooling.** `schema.sql` is a single hand-maintained file for brand-new databases. `server/src/db/migrate.ts` covers everything added after the original schema (idempotent — safe to run against a database that already has some, none, or all of it) but there's no framework tracking which migrations have run where; every future schema change needs a new idempotent statement added there by hand.
- **Report photos are base64 data URLs.** Interim storage (`reports.photo_url` is `TEXT`) until real object storage (Railway volume / S3 / etc.) is wired in.
- **Rate limiting is per-process.** `express-rate-limit`'s default in-memory store resets on restart and isn't shared across instances — fine for a single-instance deployment, would need `rate-limit-redis` (or similar) to scale horizontally.
- **CSP/X-Frame-Options for the frontend itself aren't set here.** `helmet` on the Express app only covers API responses (plus the one HTML page at `/api/auth/verify-email`); headers for the React SPA the browser actually renders need to be configured at whatever static host serves `client/` (e.g. a `vercel.json`/`netlify.toml` headers block).

## Removed: OpenFDA integration

An earlier iteration of the search feature pulled live drug label/approval/adverse-event data from the public OpenFDA API (`api.fda.gov`). It was removed in favor of the local, curated verification flow described above — there is no OpenFDA-dependent code left in the codebase.
