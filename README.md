# Hakikisha

Hakikisha ("assurance" / "make certain" in Swahili) is a medicine authenticity verification tool. Consumers scan a medicine's barcode and are walked through a guided flow to confirm the product is genuine: the medicine is identified against a local registry, matched against reference packaging photos, checked against a genuine-package checklist and a side-by-side comparison checklist, and finally pointed to nearby pharmacies.

## Tech stack

**Client** — React 19 + TypeScript, Vite, React Router 7, Axios
**Server** — Node.js, Express 5 + TypeScript, PostgreSQL (`pg`), JWT auth (`jsonwebtoken`), `bcryptjs`, Vitest + Supertest for tests

## Project structure

```
Hakikisha/
├── client/                    React SPA
│   └── src/
│       ├── api/                Axios client + typed API calls (medicines.ts, client.ts)
│       ├── context/             AuthContext (login/logout/session state)
│       ├── hooks/                useAuth
│       ├── pages/                Route-level components
│       └── types/                 Shared TS types (medicine.ts)
├── server/                   Express API
│   ├── src/
│   │   ├── db/                  pool.ts, schema.sql, seed.ts
│   │   ├── lib/                   tokens.ts (JWT + refresh token helpers)
│   │   ├── middleware/            auth.ts (Bearer token verification)
│   │   ├── routes/                auth.ts, medicines.ts, pharmacies.ts
│   │   ├── types/                  express.d.ts (Request.user augmentation)
│   │   ├── app.ts                  Express app wiring (CORS, routers, error handler)
│   │   └── index.ts                 Entry point
│   └── postman/                 hakikisha-new-endpoints.postman_collection.json
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
   JWT_EXPIRES_IN=15m
   CLIENT_URL=http://localhost:5173
   ```
3. Create the database, then apply the schema:
   ```
   psql -d hakikisha_db -f src/db/schema.sql
   ```
4. Seed sample data (medicines, reference photos, verification checklists, pharmacies):
   ```
   npx ts-node src/db/seed.ts
   ```
5. Run the API: `npm run dev` (nodemon + ts-node, watches `src/`)

### Client setup

1. `cd client && npm install`
2. (Optional) create `client/.env` with `VITE_API_URL=http://localhost:5000` if the API isn't on the default `http://localhost:5000`
3. `npm run dev`

### Tests

- Server: `cd server && npm test` (Vitest)
- Typecheck: `npx tsc --noEmit` (server) / `npx tsc -b` (client)

## Database schema

Defined in `server/src/db/schema.sql`.

| Table | Purpose |
|---|---|
| `users` | Accounts. `role` is one of `admin`, `manufacturer`, `pharmacist`, `consumer`. |
| `medicines` | One row per registered medicine/product: name, generic name, manufacturer, dosage form, strength, 13-digit EAN barcode, regulatory body, approval number/status. |
| `batch_records` | Production batches of a medicine (batch number, manufacture/expiry dates, quantity, QR hash, status). |
| `medicine_photos` | Reference **front**/**back** packaging photos per medicine (`angle` enum `front`/`back`, `image_url`). One row per angle per medicine. |
| `verification_checklist_items` | Backs *both* checklists in the scan flow via a `section` enum: `package_verification` (the "How to Identify a Genuine Package" ✓ list) and `safety_comparison` (the "Things to Compare" ☐ list). Ordered by `display_order`. |
| `pharmacies` | Pharmacy directory: name, address, latitude/longitude, phone. Used for the "nearby pharmacy" step. |
| `scans` | One row per barcode lookup: which batch (if matched), who scanned it (nullable — scanning doesn't require login), the result (`authentic`/`counterfeit`/`expired`/`unknown`), and optional lat/lng. |
| `reports` | User-filed reports linked to a `scan`, with an investigation status. |
| `refresh_tokens` / `revoked_access_tokens` | JWT refresh-token rotation and access-token revocation (logout) bookkeeping. |

All new tables (`medicine_photos`, `verification_checklist_items`, `pharmacies`) and their indexes were added in this pass; everything else pre-existed.

## API reference

None of the routes below require authentication (no `Authorization` header needed) except `/api/auth/logout` and `/api/auth/me`.

### Auth — `/api/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | `{ email, password, fullName, country, role? }` | `role` defaults to `consumer`; self-registration only allows `manufacturer`/`pharmacist`/`consumer`. |
| POST | `/login` | `{ email, password }` | Returns `{ accessToken, refreshToken, user }`. |
| POST | `/refresh` | `{ refreshToken }` | Rotates the refresh token (old one is revoked). |
| POST | `/logout` | `{ refreshToken? }` (Bearer token required) | Revokes the current access token (jti) and the given refresh token. |
| GET | `/me` | — (Bearer token required) | Returns the current user. |

### Medicines — `/api/medicines`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/search` | query: `q`, `page?` | ILIKE match against `name`/`generic_name` in the local DB, paginated 10/page. |
| GET | `/barcode/:barcode` | path: `barcode` (8–13 digits); query: `lat?`, `lng?` | Looks up a medicine by barcode + its latest batch. **Also writes a row to `scans`** on every lookup (result derived from expiry/approval status; `lat`/`lng` recorded if provided). |
| GET | `/:id` | path: `id` (UUID) | Full medicine record by id. |
| GET | `/:id/verification` | path: `id` (UUID) | **New.** Returns `{ medicine, photos: { front, back }, packageVerification: string[], safetyComparison: string[] }` — everything the scan flow needs after a medicine is identified. |

### Pharmacies — `/api/pharmacies`
| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/nearby` | query: `lat`, `lng` (required), `radiusKm?` (default 10) | **New.** Returns pharmacies within `radiusKm` of the given point, sorted nearest-first, with a computed `distanceKm`. Distance is plain Haversine math done in the SQL query (no PostGIS). |

A ready-to-import Postman collection covering all of the above (including error-path tests: not-found, invalid id, invalid barcode, missing coords) lives at `server/postman/hakikisha-new-endpoints.postman_collection.json`.

## The scan verification flow

`client/src/pages/BarcodeScanPage.tsx` drives a six-step wizard, with a progress indicator across the top:

1. **Scan** — enter a barcode, calls `GET /api/medicines/barcode/:barcode`.
2. **Medicine identified** — shows the matched medicine, batch, expiry, and registration/verification status.
3. **Reference photos** — fetches `GET /api/medicines/:id/verification` and shows the front/back reference images.
4. **Package verification** — "How to Identify a Genuine Package": a static ✓ checklist from `packageVerification`.
5. **Safety information** — "Things to Compare": an interactive ☐ checklist (local state only, not persisted) from `safetyComparison`.
6. **Nearby pharmacy** — requests browser geolocation, then calls `GET /api/pharmacies/nearby` and lists results with distance.

If the barcode isn't found, the flow stops at step 1 with an "Unknown Product" message (not necessarily counterfeit — just not in the database).

## Known limitations / next steps

- **Reference photos are placeholders.** Seed data points `medicine_photos` at generated placeholder images (`placehold.co`), not real product photography. Real manufacturer-supplied photos are needed before this is production-ready.
- **Checklist text is generic, not per-product.** `packageVerification` items are dosage-form-aware but generic (e.g. "Hologram or security seal present") rather than describing a specific product's actual packaging (exact colours, logo placement, etc.), since no real manufacturer artwork/specs were available to seed accurately. `safetyComparison` is the same fixed 5-item list for every medicine.
- **Pharmacies aren't linked to specific medicines.** `/api/pharmacies/nearby` returns any nearby pharmacy, not ones confirmed to stock the scanned medicine — there's no stock/inventory join table yet.
- **No auth on medicine/pharmacy routes.** Anyone can hit `/api/medicines/*` and `/api/pharmacies/*` without logging in (by design, so scanning works for anonymous users) — `scanned_by` on a `scans` row is only populated if a valid Bearer token happens to be present.
- **No migration tooling.** `schema.sql` is a single hand-maintained file (no versioned migrations); new tables were applied directly via a one-off script during development. Any future schema change needs to be applied manually to existing databases.

## Removed: OpenFDA integration

An earlier iteration of the search feature pulled live drug label/approval/adverse-event data from the public OpenFDA API (`api.fda.gov`). It was removed in favor of the local, curated verification flow described above — there is no OpenFDA-dependent code left in the codebase.
