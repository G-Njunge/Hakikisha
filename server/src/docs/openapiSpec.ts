// Hand-written OpenAPI 3.0 spec (not JSDoc-scanned) covering every endpoint
// in server/src/routes/. Kept as a single object so it stays easy to scan
// and update alongside route changes — with ~17 endpoints across 5 files,
// this is simpler than annotating every route for a scanner to parse.

const cookieAuthNote =
  "Requires a valid hakikisha_access_token cookie (set by /login or /refresh). " +
  "Mutating requests also require a matching X-CSRF-Token header (see the hakikisha_csrf_token cookie).";

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Hakikisha API",
    version: "1.0.0",
    description:
      "Medicine authenticity verification API. Auth is cookie-based (httpOnly access/refresh cookies set by " +
      "/api/auth/login), with a double-submit CSRF cookie required on mutating requests.",
  },
  servers: [{ url: "/", description: "Same origin as this docs page" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "hakikisha_access_token",
        description: cookieAuthNote,
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string" },
          fullName: { type: "string" },
          country: { type: "string" },
          role: { type: "string", enum: ["admin", "manufacturer", "pharmacist", "consumer"] },
          isVerified: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Medicine: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          genericName: { type: "string", nullable: true },
          manufacturer: { type: "string" },
          dosageForm: { type: "string", nullable: true },
          strength: { type: "string", nullable: true },
          barcode: { type: "string" },
          regulatoryBody: { type: "string" },
          approvalNumber: { type: "string" },
          approvalStatus: { type: "string", enum: ["approved", "pending", "rejected", "expired"] },
        },
      },
      Pharmacy: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          phone: { type: "string", nullable: true },
          hours: { type: "string", nullable: true },
          distanceKm: { type: "number" },
          stocksMedicine: { type: "boolean", nullable: true },
          isOpenNow: { type: "boolean", nullable: true },
        },
      },
      ReportStatus: {
        type: "string",
        enum: ["pending", "investigating", "resolved", "dismissed", "escalated"],
      },
      VerificationProfile: {
        type: "object",
        properties: {
          medicine: { $ref: "#/components/schemas/Medicine" },
          photos: {
            type: "object",
            properties: {
              tablet: { type: "string", nullable: true },
              package: { type: "string", nullable: true },
            },
          },
          packageVerification: { type: "array", items: { type: "string" } },
          safetyComparison: { type: "array", items: { type: "string" } },
        },
      },
      ScanResult: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["VERIFIED", "UNVERIFIED"] },
          scanId: { type: "string", format: "uuid" },
          medicine: {
            nullable: true,
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              manufacturer: { type: "string" },
              approvalStatus: { type: "string", enum: ["approved", "pending", "rejected", "expired"] },
            },
          },
          batchNumber: { type: "string", nullable: true },
          expiryDate: { type: "string", format: "date-time", nullable: true },
          message: { type: "string", description: "Plain-language reason, present whenever status isn't a clean VERIFIED" },
        },
      },
      ScanHistoryEntry: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          barcode: { type: "string", nullable: true },
          medicineId: { type: "string", format: "uuid", nullable: true },
          medicineName: { type: "string", nullable: true },
          result: { type: "string", enum: ["authentic", "expired", "unknown"] },
          scannedAt: { type: "string", format: "date-time" },
        },
      },
      ReportSummary: {
        type: "object",
        description: "Shape returned by POST /api/reports and GET /api/reports/my — omits the (potentially multi-MB base64) photo in favor of a boolean.",
        properties: {
          id: { type: "string", format: "uuid" },
          scanId: { type: "string", format: "uuid", nullable: true },
          productName: { type: "string", nullable: true },
          description: { type: "string" },
          country: { type: "string", nullable: true },
          purchaseLocation: { type: "string", nullable: true },
          hasPhoto: { type: "boolean" },
          status: { $ref: "#/components/schemas/ReportStatus" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      ReportAdmin: {
        type: "object",
        description: "Shape returned by the admin-only GET /api/reports and PATCH /api/reports/{id} — includes reporter identity, resolved medicine name, and the full photo.",
        properties: {
          id: { type: "string", format: "uuid" },
          scanId: { type: "string", format: "uuid", nullable: true },
          productName: { type: "string", nullable: true },
          medicineName: { type: "string", nullable: true, description: "Resolved via the linked scan's batch, when scanId is set" },
          description: { type: "string" },
          country: { type: "string", nullable: true },
          purchaseLocation: { type: "string", nullable: true },
          photoUrl: { type: "string", nullable: true, description: "base64 data URL" },
          status: { $ref: "#/components/schemas/ReportStatus" },
          adminNotes: { type: "string", nullable: true },
          reporter: {
            nullable: true,
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", nullable: true },
              fullName: { type: "string", nullable: true },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/auth/check-email": {
      get: {
        tags: ["Auth"],
        summary: "Check whether an email is valid/available before submitting the registration form",
        parameters: [{ name: "email", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Format/availability result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { validFormat: { type: "boolean" }, available: { type: "boolean", nullable: true } },
                },
              },
            },
          },
          "400": { description: "email query param missing" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "fullName", "country"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string", description: "8+ chars, upper+lower+digit" },
                  fullName: { type: "string" },
                  country: { type: "string" },
                  role: { type: "string", enum: ["manufacturer", "pharmacist", "consumer"], default: "consumer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Account created", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Email already registered" },
        },
      },
    },
    "/api/auth/verify-email": {
      get: {
        tags: ["Auth"],
        summary: "Verify an email address via the link sent on registration",
        description: "Not a JSON endpoint — renders a small standalone HTML confirmation page.",
        parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "HTML confirmation page" }, "400": { description: "Invalid/expired token" }, "404": { description: "Account not found" } },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Sets hakikisha_access_token, hakikisha_refresh_token, and hakikisha_csrf_token cookies. Also returns " +
          "csrfToken in the body — the client/server are on different origins in production, so the CSRF cookie " +
          "isn't readable via document.cookie from the client's page; the body is the actual source of truth.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string" }, password: { type: "string" }, remember: { type: "boolean" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/User" }, csrfToken: { type: "string" } },
                },
              },
            },
          },
          "401": { description: "Invalid email or password" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate the refresh token and re-issue all auth cookies",
        description:
          "Reads hakikisha_refresh_token from the request cookie — no request body. Returns the rotated " +
          "csrfToken in the body for the same cross-origin reason described on /login.",
        responses: {
          "200": {
            description: "Cookies rotated",
            content: { "application/json": { schema: { type: "object", properties: { csrfToken: { type: "string" } } } } },
          },
          "401": { description: "Missing/invalid/expired refresh token" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description: cookieAuthNote,
        security: [{ cookieAuth: [] }],
        responses: { "204": { description: "Logged out, cookies cleared" }, "401": { description: "Not authenticated" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current user",
        description: "Also returns the current csrfToken in the body, letting the client resync it on page load.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    csrfToken: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update the current user's display name",
        security: [{ cookieAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["fullName"], properties: { fullName: { type: "string" } } } } } },
        responses: { "200": { description: "Updated user" }, "400": { description: "fullName missing/blank" }, "401": { description: "Not authenticated" } },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change the current user's password",
        description: "Revokes all other active sessions on success. " + cookieAuthNote,
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: { currentPassword: { type: "string" }, newPassword: { type: "string" } },
              },
            },
          },
        },
        responses: { "204": { description: "Password changed" }, "400": { description: "Validation error" }, "401": { description: "Current password incorrect / not authenticated" } },
      },
    },
    "/api/medicines/search": {
      get: {
        tags: ["Medicines"],
        summary: "Search medicines by brand or generic name",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: { "200": { description: "Paginated results" }, "400": { description: "q missing/blank" } },
      },
    },
    "/api/medicines/barcode/{barcode}": {
      get: {
        tags: ["Medicines"],
        summary: "Look up a medicine by scanned/entered barcode",
        parameters: [
          { name: "barcode", in: "path", required: true, schema: { type: "string", pattern: "^[0-9]{8,13}$" } },
          { name: "lat", in: "query", schema: { type: "number" } },
          { name: "lng", in: "query", schema: { type: "number" } },
        ],
        responses: { "200": { description: "Found or not-found verification result" }, "400": { description: "Invalid barcode format" } },
      },
    },
    "/api/medicines/{id}": {
      get: {
        tags: ["Medicines"],
        summary: "Get a medicine by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Medicine", content: { "application/json": { schema: { type: "object", properties: { medicine: { $ref: "#/components/schemas/Medicine" } } } } } },
          "400": { description: "Invalid id" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/medicines/{id}/verification": {
      get: {
        tags: ["Medicines"],
        summary: "Get a medicine's reference photos and verification checklists",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Verification profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerificationProfile" } } },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/pharmacies/nearby": {
      get: {
        tags: ["Pharmacies"],
        summary: "Find pharmacies near a coordinate",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number" } },
          { name: "lng", in: "query", required: true, schema: { type: "number" } },
          { name: "radiusKm", in: "query", schema: { type: "number", default: 10 } },
          { name: "medicineId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "openNow", in: "query", schema: { type: "string", enum: ["true"] }, description: "Filter to only pharmacies currently open" },
        ],
        responses: {
          "200": {
            description: "Nearby pharmacies, sorted by stock confirmation then distance",
            content: { "application/json": { schema: { type: "object", properties: { results: { type: "array", items: { $ref: "#/components/schemas/Pharmacy" } } } } } },
          },
          "400": { description: "lat/lng missing or medicineId invalid" },
        },
      },
    },
    "/api/scans": {
      post: {
        tags: ["Scans"],
        summary: "Record a barcode scan and get a verification result",
        description: "Authentication optional — attributes the scan to a user if a valid access-token cookie is present.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["barcode"],
                properties: { barcode: { type: "string", pattern: "^[0-9]{8,13}$" }, lat: { type: "number" }, lng: { type: "number" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verification result (VERIFIED or UNVERIFIED)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ScanResult" } } },
          },
          "400": { description: "Invalid barcode" },
        },
      },
    },
    "/api/scans/my": {
      get: {
        tags: ["Scans"],
        summary: "Get the current user's scan history",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Scan history",
            content: {
              "application/json": {
                schema: { type: "object", properties: { scans: { type: "array", items: { $ref: "#/components/schemas/ScanHistoryEntry" } } } },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/reports": {
      post: {
        tags: ["Reports"],
        summary: "Submit a counterfeit/substandard medicine report",
        security: [{ cookieAuth: [] }],
        description: "Best-effort emails the health authority on file for the report's country. " + cookieAuthNote,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["description", "country"],
                properties: {
                  scanId: { type: "string", format: "uuid" },
                  productName: { type: "string" },
                  description: { type: "string" },
                  country: { type: "string" },
                  purchaseLocation: { type: "string" },
                  photoUrl: { type: "string", description: "base64 data URL, interim storage" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Report created",
            content: { "application/json": { schema: { type: "object", properties: { report: { $ref: "#/components/schemas/ReportSummary" } } } } },
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
        },
      },
      get: {
        tags: ["Reports"],
        summary: "List all reports (admin only)",
        security: [{ cookieAuth: [] }],
        description: "Also marks this admin's reports as viewed (clears the unread-count badge). " + cookieAuthNote,
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/ReportStatus" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["newest", "oldest"], default: "newest" } },
        ],
        responses: {
          "200": {
            description: "Paginated reports",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reports: { type: "array", items: { $ref: "#/components/schemas/ReportAdmin" } },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        pageSize: { type: "integer" },
                        totalCount: { type: "integer" },
                        totalPages: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin" },
        },
      },
    },
    "/api/reports/my": {
      get: {
        tags: ["Reports"],
        summary: "Get the current user's own filed reports",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Own reports",
            content: {
              "application/json": {
                schema: { type: "object", properties: { reports: { type: "array", items: { $ref: "#/components/schemas/ReportSummary" } } } },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/reports/unread-count": {
      get: {
        tags: ["Reports"],
        summary: "Count of reports filed since this admin last viewed the reports table (admin only)",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Unread count", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" } } } } } },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin" },
        },
      },
    },
    "/api/reports/{id}": {
      patch: {
        tags: ["Reports"],
        summary: "Change a report's status and/or set internal admin notes (admin only)",
        security: [{ cookieAuth: [] }],
        description: cookieAuthNote,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "At least one of action/notes is required.",
                properties: {
                  action: { type: "string", enum: ["approve", "dismiss", "review", "escalate"] },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated report",
            content: { "application/json": { schema: { type: "object", properties: { report: { $ref: "#/components/schemas/ReportAdmin" } } } } },
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin" },
          "404": { description: "Report not found" },
        },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Overview stats for the admin dashboard (admin only)",
        security: [{ cookieAuth: [] }],
        description: cookieAuthNote,
        responses: {
          "200": {
            description: "Aggregate counts across users, medicines, pharmacies, scans, and reports",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalUsers: { type: "integer" },
                    usersByRole: {
                      type: "object",
                      properties: {
                        admin: { type: "integer" },
                        manufacturer: { type: "integer" },
                        pharmacist: { type: "integer" },
                        consumer: { type: "integer" },
                      },
                    },
                    totalMedicines: { type: "integer" },
                    totalPharmacies: { type: "integer" },
                    totalScans: { type: "integer" },
                    scansByResult: {
                      type: "object",
                      properties: {
                        authentic: { type: "integer" },
                        expired: { type: "integer" },
                        unknown: { type: "integer" },
                      },
                    },
                    scansLast7Days: {
                      type: "array",
                      description: "Oldest to newest, always exactly 7 entries (0-filled for quiet days)",
                      items: {
                        type: "object",
                        properties: { date: { type: "string", format: "date" }, count: { type: "integer" } },
                      },
                    },
                    totalReports: { type: "integer" },
                    reportsByStatus: {
                      type: "object",
                      properties: {
                        pending: { type: "integer" },
                        investigating: { type: "integer" },
                        escalated: { type: "integer" },
                        resolved: { type: "integer" },
                        dismissed: { type: "integer" },
                      },
                    },
                    topScannedMedicines: {
                      type: "array",
                      items: { type: "object", properties: { name: { type: "string" }, count: { type: "integer" } } },
                    },
                    recentReports: { type: "array", items: { $ref: "#/components/schemas/ReportAdmin" } },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Not an admin" },
        },
      },
    },
  },
};
