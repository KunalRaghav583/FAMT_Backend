# Field Asset Maintenance Tracker (FAMT) — Master PDF Compliance & Audit Report

**Date**: October 16, 2026  
**Repository**: `FAMT_Backend`  
**Current Active Branch**: `fix/register-role-lock`  
**Evaluation Standard**: Original 5-page Assignment PDF (_Full Stack Training Project — Field Asset Maintenance Tracker.pdf_)

---

## A. Executive Summary

This report establishes the complete, evidence-based compliance status of the Field Asset Maintenance Tracker (FAMT) backend codebase against the original five-page training project assignment specification.

All confirmed mismatches between the baseline implementation and the PDF requirements have been systematically resolved, verified with automated integration tests, and validated through TypeScript strict compilation, ESLint, Prettier, and Prisma database schema checks.

### Key Milestones Achieved:

1. **100% PDF Route & Access Compliance**: Enforced strict `Admin or assignee` authorization on `GET /api/tickets/:id` and `PUT /api/tickets/:id`; enforced Technician-only assignment validation on ticket creation/updating; implemented strict state machine transitions (`Open` → `In progress` → `Resolved` → `Closed` with Admin reopening).
2. **Database-Backed Authentication Verification**: `requireAuth` middleware now strictly validates the user's existence against the live PostgreSQL database on every authenticated request, rejecting tokens referencing deleted or nonexistent users with HTTP 401.
3. **Public Registration Security Lock**: Initial bootstrap user safely receives `Admin` role; all subsequent public registrations unconditionally receive `Viewer` role (ignoring any requested role in payload); only authenticated Admins can provision elevated roles.
4. **Zero Regressions & Comprehensive Verification**: The test suite expanded from 126 tests to **135 passed tests** across all 8 suites with 0 failures, 0 TypeScript errors, 0 ESLint warnings, and 100% Prettier compliance.

---

## B. PDF Compliance Matrix

The following table evaluates every explicit requirement from the 5-page assignment PDF against the final codebase implementation:

| PDF Page & Section               | Explicit PDF Requirement                                                                                      | Previous Behavior                          | Final Verified Behavior                                                                         | Files Modified                            | Test Evidence             | Compliance Status |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------- | ----------------- |
| **Page 1: Tech Stack**           | Node.js 20 LTS, Express, TypeScript (strict, no `any`), PostgreSQL, Prisma, Zod, JWT, bcrypt, Jest, Supertest | Compliant                                  | Compliant across entire codebase                                                                | `tsconfig.json`, `package.json`           | `tests/setup.test.ts`     | **PASS**          |
| **Page 2: Roles**                | 3 Roles: `Admin`, `Technician`, `Viewer`                                                                      | TitleCase enums preserved                  | Intact enums (`Role.Admin`, `Role.Technician`, `Role.Viewer`)                                   | `prisma/schema.prisma`                    | `tests/db.test.ts`        | **PASS**          |
| **Page 2 & 4: Auth Register**    | `POST /auth/register` creates user; public creates Viewer; first user Admin                                   | Allowed public role choice or 403 on Admin | First user is Admin; public registration forced to Viewer; Admin with JWT assigns roles         | `src/controllers/auth.controller.ts`      | `tests/auth.test.ts`      | **PASS**          |
| **Page 2 & 4: Auth Login & JWT** | `POST /auth/login` returns signed JWT; bcrypt hash verification                                               | Compliant                                  | Compliant (bcrypt cost 10, signed JWT, no password hash exposed)                                | `src/controllers/auth.controller.ts`      | `tests/auth.test.ts`      | **PASS**          |
| **Page 2 & 4: Auth Logout**      | Register, login, logout with JWT                                                                              | Stateless logout implemented               | Stateless logout acknowledgment with client token discard instructions                          | `src/controllers/auth.controller.ts`      | `tests/auth.test.ts`      | **PASS**          |
| **Page 2: Sites CRUD**           | Sites CRUD (name, location); Admin only for writes                                                            | Compliant                                  | GET any logged-in; POST, PUT, DELETE Admin only (403 for others)                                | `src/routes/site.routes.ts`               | `tests/sites.test.ts`     | **PASS**          |
| **Page 2: Assets CRUD**          | Assets CRUD (name, type, serial_no, status, site_id)                                                          | Compliant                                  | GET any logged-in; POST, PUT, DELETE Admin only; status enum Active/Under maintenance/Retired   | `src/routes/asset.routes.ts`              | `tests/assets.test.ts`    | **PASS**          |
| **Page 2: Asset Filters**        | Search, filter by site & status, pagination                                                                   | Compliant                                  | Deterministic pagination with ID tie-breaker; search and filter support                         | `src/controllers/asset.controller.ts`     | `tests/assets.test.ts`    | **PASS**          |
| **Page 2: Ticket Assignment**    | "Assign to a technician"                                                                                      | Rejected Viewer, allowed Admin             | Rejects any assignee who does not hold `Role.Technician` (Viewer or Admin rejected with 400)    | `src/controllers/ticket.controller.ts`    | `tests/tickets.test.ts`   | **PASS**          |
| **Page 2: Ticket Status Flow**   | `Open` → `In progress` → `Resolved` → `Closed` (Admin can reopen)                                             | Partial transition validation              | Strict state machine: skips rejected with 400; Technician cannot reopen (403); Admin can reopen | `src/controllers/ticket.controller.ts`    | `tests/tickets.test.ts`   | **PASS**          |
| **Page 2: Comments**             | Comments on ticket with author and timestamp                                                                  | Compliant                                  | Any logged-in user can list and add comments; author automatically set from JWT                 | `src/controllers/comment.controller.ts`   | `tests/comments.test.ts`  | **PASS**          |
| **Page 3: Dashboard**            | Counts: open, overdue, assets under maintenance; charts; "My tickets"                                         | Compliant                                  | Live DB counts; real-time aggregations; overdue uses due_date + status; assigneeId filter       | `src/controllers/dashboard.controller.ts` | `tests/dashboard.test.ts` | **PASS**          |
| **Page 3: Data Model**           | 5 tables; sensible ON DELETE; composite index `tickets(status, assignee_id)`                                  | Compliant                                  | RESTRICT on Site->Asset & Asset->Ticket; SET NULL on Assignee->Ticket; composite index verified | `prisma/schema.prisma`                    | `tests/db.test.ts`        | **PASS**          |
| **Page 3: Seed Script**          | 2 sites, 10 assets, 20 tickets, 1 user per role                                                               | Compliant                                  | Seed script produces exact counts idempotently                                                  | `prisma/seed.ts`                          | `tests/db.test.ts`        | **PASS**          |
| **Page 4: Route Spec**           | All routes under `/api`, return JSON, valid JWT                                                               | Compliant                                  | Mounted under `/api`; consistent `{ "error": "message" }` format                                | `src/routes/index.ts`, `src/app.ts`       | `tests/auth.test.ts`      | **PASS**          |
| **Page 4: Ticket Detail Access** | `GET, PUT /tickets/:id` Access: **Admin or assignee**                                                         | GET allowed any logged-in                  | GET & PUT restricted to Admin or assigned Technician (403 for unassigned Tech & Viewer)         | `src/controllers/ticket.controller.ts`    | `tests/tickets.test.ts`   | **PASS**          |

---

## C. Fixes Completed in This Task

1. **Ticket Detail Permissions (`GET /api/tickets/:id`)**:
   - **Requirement**: PDF Page 4 explicitly designates access as **Admin or assignee**.
   - **Action**: Updated `getTicketById` in `src/controllers/ticket.controller.ts` to check `const isAdmin = req.user?.role === Role.Admin; const isAssignee = ticket.assigneeId === req.user?.id;`. If neither is true, throws `AppError("Forbidden: Only an Admin or the assigned technician can access this ticket", 403)`.
   - **Tests Added**: Verified Admin (200), assigned Technician (200), unassigned Technician (403), Viewer (403), nonexistent ticket (404).

2. **Strict Technician-Only Assignment**:
   - **Requirement**: PDF Page 2 specifies tickets are assigned to a technician; non-technicians must not be assigned.
   - **Action**: Updated `createTicket` and `updateTicket` in `src/controllers/ticket.controller.ts` to verify `assigneeUser.role === Role.Technician`. Attempting to assign to a Viewer or Admin produces an explicit 400 Bad Request error.
   - **Tests Added**: Verified that assigning a ticket to an Admin user fails with HTTP 400.

3. **Status Workflow State Machine Enforcement**:
   - **Requirement**: PDF Page 2 mandates the exact flow: `Open → In progress → Resolved → Closed (Admin can reopen)`.
   - **Action**: Implemented `validateStatusTransition` in `src/controllers/ticket.controller.ts` preventing callers from skipping intermediate workflow states (e.g., jumping from `Open` directly to `Closed` returns HTTP 400). Admin reopening is strictly enforced (Technician attempting `Closed` → `Open` receives 403).
   - **Tests Added**: Verified illegal status jumps (`Open` → `Closed` and `Open` → `Resolved` by technician) return HTTP 400.

4. **Live Database Verification in Auth Middleware**:
   - **Requirement**: Tokens referring to deleted or nonexistent database users must not grant access.
   - **Action**: Updated `requireAuth` and `optionalAuth` in `src/middleware/auth.middleware.ts` to perform an asynchronous lookup against `prisma.user` following JWT signature verification. If the user record no longer exists, throws HTTP 401 (`"User account no longer exists"`).
   - **Tests Added**: Verified that a validly signed JWT referencing a non-existent UUID fails authentication with HTTP 401.

5. **Registration Role Lock & Bootstrap Concurrency**:
   - **Requirement**: First user bootstrap creates Admin; subsequent registrations cannot select privileged roles; public registration always yields Viewer.
   - **Action**: Enforced in `src/controllers/auth.controller.ts` using `prisma.$transaction`. Public role parameters are safely ignored; authenticated Admins can provision any valid role.

6. **Documentation & Seed Synchronization**:
   - **Requirement**: Remove discrepancy between documented example emails (`@famt.com`) and actual database seed (`@famt.dev`).
   - **Action**: Updated `README.md`, `docs/API_DOCUMENTATION.md`, `docs/DEPLOYMENT.md`, and Postman environment to uniformly use `@famt.dev`.

---

## D. Role-Permission Matrix (Final Verified State)

| Endpoint                             | Method   |      Admin       |        Technician         |      Viewer      |  Unauthenticated  |
| ------------------------------------ | -------- | :--------------: | :-----------------------: | :--------------: | :---------------: |
| `/api/auth/register` (first user)    | `POST`   | Public (`Admin`) |     Public (`Admin`)      | Public (`Admin`) | Public (`Admin`)  |
| `/api/auth/register` (subsequent)    | `POST`   | ✅ Can set role  |        Viewer only        |   Viewer only    | Viewer only (201) |
| `/api/auth/login`                    | `POST`   |        ✅        |            ✅             |        ✅        |    ✅ (Public)    |
| `/api/auth/me`                       | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/auth/logout`                   | `POST`   |        ✅        |            ✅             |        ✅        |    ✅ (Public)    |
| `/api/sites`                         | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/sites`                         | `POST`   |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/sites/:id`                     | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/sites/:id`                     | `PUT`    |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/sites/:id`                     | `DELETE` |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/assets`                        | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/assets`                        | `POST`   |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/assets/:id`                    | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/assets/:id`                    | `PUT`    |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/assets/:id`                    | `DELETE` |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/tickets`                       | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/tickets`                       | `POST`   |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/tickets/:id`                   | `GET`    |        ✅        | ✅ (if assigned) / ❌ 403 |      ❌ 403      |      ❌ 401       |
| `/api/tickets/:id`                   | `PUT`    |        ✅        | ✅ (if assigned) / ❌ 403 |      ❌ 403      |      ❌ 401       |
| `/api/tickets/:id/status` (Workflow) | `PATCH`  |        ✅        | ✅ (if assigned) / ❌ 403 |      ❌ 403      |      ❌ 401       |
| `/api/tickets/:id/status` (Reopen)   | `PATCH`  |        ✅        |          ❌ 403           |      ❌ 403      |      ❌ 401       |
| `/api/tickets/:id/comments`          | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/tickets/:id/comments`          | `POST`   |        ✅        |            ✅             |        ✅        |      ❌ 401       |
| `/api/dashboard/summary`             | `GET`    |        ✅        |            ✅             |        ✅        |      ❌ 401       |

---

## E. Database Verification

- **Prisma Schema (`prisma/schema.prisma`)**: Validated via `npx prisma validate` with 0 warnings.
- **Migration History (`prisma/migrations`)**: Exactly 1 initial migration (`20261015114450_init`); database state is 100% in sync (`Database schema is up to date!`).
- **Enums**:
  - `Role`: `Admin`, `Technician`, `Viewer`
  - `AssetStatus`: `Active`, `Under_maintenance`, `Retired`
  - `TicketPriority`: `Low`, `Medium`, `High`, `Critical`
  - `TicketStatus`: `Open`, `In_progress`, `Resolved`, `Closed`
- **Composite Index**: Verified on `Ticket(status, assigneeId)`.
- **Referential Integrity**:
  - `Site` ➔ `Asset`: `onDelete: Restrict`
  - `Asset` ➔ `Ticket`: `onDelete: Restrict`
  - `Ticket` ➔ `Comment`: `onDelete: Cascade`
  - `User` (Assignee) ➔ `Ticket`: `onDelete: SetNull`
  - `User` (Creator) ➔ `Ticket`: `onDelete: Restrict`
- **Seed Record Counts (`prisma/seed.ts`)**:
  - 3 Users (Admin, Technician, Viewer)
  - 2 Sites (HQ Data Center, North Substation)
  - 10 Assets
  - 20 Tickets (with exact overdue distributions)
  - 2 Comments

---

## F. Security Verification

1. **Password Hashing**: Verified using `bcrypt` (salt rounds = 10). Password hashes are omitted from all JSON responses via Prisma `select` projections.
2. **Input Validation**: All route parameters, query strings, and request bodies are validated using strict Zod schemas (`.strict()`). Unrecognized or extraneous properties are rejected with HTTP 400.
3. **Identity Spoofing Protection**: `createdBy` on tickets and `userId` on comments are extracted directly from the authenticated session context (`req.user.id`), never from client payloads.
4. **Environment Security**: No secrets or credentials exist in source code. `.env.example` contains sanitized placeholders; `.env` is git-ignored.

---

## G. Test and Quality Verification Results

All quality commands were executed locally with verified passing results:

```bash
# 1. Prisma Schema Validation
$ npx prisma validate
Environment variables loaded from .env
The schema at prisma/schema.prisma is valid 🚀

# 2. Migration Status
$ npx prisma migrate status
Database schema is up to date! (1 migration found)

# 3. TypeScript Strict Typecheck
$ npm run typecheck
> tsc --noEmit
# Exit code 0 (0 errors)

# 4. ESLint Check
$ npm run lint
> eslint "src/**/*.ts" "tests/**/*.ts"
# Exit code 0 (0 warnings, 0 errors)

# 5. Prettier Code Style Check
$ npm run format:check
> prettier --check "src/**/*.ts" "tests/**/*.ts" "*.json" "*.md"
All matched files use Prettier code style!

# 6. Production Build Compilation
$ npm run build
> rimraf dist && tsc -p tsconfig.build.json
# Exit code 0 (Compiled successfully)

# 7. Complete Jest & Supertest Test Suite
$ npm test
Test Suites: 8 passed, 8 total
Tests:       135 passed, 135 total
Snapshots:   0 total
Time:        3.646 s
```

### Test Suite Execution Breakdown:

- `tests/setup.test.ts`: 1 test passed
- `tests/db.test.ts`: 6 tests passed
- `tests/auth.test.ts`: 21 tests passed
- `tests/sites.test.ts`: 20 tests passed
- `tests/assets.test.ts`: 24 tests passed
- `tests/tickets.test.ts`: 33 tests passed
- `tests/comments.test.ts`: 10 tests passed
- `tests/dashboard.test.ts`: 20 tests passed

---

## H. Documentation and Git Status

- **Working Branch**: `fix/register-role-lock`
- **Main Branch**: Unmodified (commit `ec788ea` preserved).
- **Postman Collection**: `postman/FAMT_Backend.postman_collection.json` committed with all required endpoints and realistic payloads.
- **Postman Environment**: `postman/FAMT_Local.postman_environment.json` updated with `@famt.dev` domains.
- **Documentation**: `README.md` and `docs/API_DOCUMENTATION.md` updated to reflect PDF route permissions and seeded accounts.

---

## I. Remaining Scope & Boundary Limitations

1. **Frontend Scope**: The React + Vite + Tailwind UI mentioned in Page 1 of the assignment PDF is not part of this backend repository and must be built/evaluated in the frontend repository (`client/`).
2. **Live Cloud Deployment**: Deployment scripts and guides for Railway, Render, and Neon are prepared in `docs/DEPLOYMENT.md`; live cloud provisioning requires external account credentials outside local development.
3. **Stretch Goals**: Per PDF Page 5 guidelines, stretch goals (file uploads, notifications, recurring schedules, CSV export, Docker Compose) are intentionally deferred until the core evaluation passes.

---

## J. Final Conclusion

- **Backend PDF Requirements**: **100% VERIFIED AND PASSING**. All routes, controllers, middleware, models, seed data, and engineering rules conform strictly to the assignment PDF.
- **Full-Stack Assignment Submission**: The backend component is completely ready for mentor review and integration with the React UI.
