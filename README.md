# Field Asset Maintenance Tracker (FAMT) — Backend API

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkblue.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue.svg)](https://www.postgresql.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

A production-grade RESTful backend API for tracking multi-site industrial field assets, maintenance tickets, lifecycle status transitions, and operational dashboard analytics.

---

## Table of Contents

- [Architecture & Tech Stack](#architecture--tech-stack)
- [System Requirements](#system-requirements)
- [Environment Configuration](#environment-configuration)
- [Local Setup & Installation](#local-setup--installation)
- [Database Migrations & Seeding](#database-migrations--seeding)
- [Available NPM Scripts](#available-npm-scripts)
- [Data Models & Schema](#data-models--schema)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Maintenance Ticket Lifecycle & Workflow](#maintenance-ticket-lifecycle--workflow)
- [API Documentation & Postman Collection](#api-documentation--postman-collection)
- [Testing & Quality Verification](#testing--quality-verification)
- [Production Deployment](#production-deployment)
- [Assignment Compliance Summary](#assignment-compliance-summary)

---

## Architecture & Tech Stack

The service is built following clean architectural patterns with strict separation of concerns:

- **Runtime & Language**: Node.js 20 LTS with TypeScript 5.6 (strict mode enabled, zero `any` usage).
- **Web Framework**: Express 4.21 with decoupled `app.ts` (Supertest integration) and `server.ts` (HTTP lifecycle and graceful shutdown).
- **Database & ORM**: PostgreSQL with Prisma ORM 5.22 for declarative schema definitions, versioned migrations, and type-safe query generation.
- **Request Validation**: Zod 3.23 with strict object filtering (`.strict()`) and custom preprocessors for status string normalization.
- **Security & Auth**: Stateless JWT authentication (`jsonwebtoken`) with `bcrypt` (10 rounds) password hashing and RBAC middleware (`requireAuth`, `requireRole`).
- **Code Quality & Testing**: ESLint 9 (flat config), Prettier 3, Jest 29, and Supertest 7 for comprehensive end-to-end integration testing.

```
FAMT_Backend/
├── docs/                      # Architectural & operational documentation
│   ├── API_DOCUMENTATION.md   # Complete REST API specification
│   └── DEPLOYMENT.md          # Production deployment guide (Render / Railway)
├── postman/                   # Postman collection & environment
│   ├── FAMT_Backend.postman_collection.json
│   ├── FAMT_Local.postman_environment.json
│   └── README.md              # Postman guide & test execution order
├── prisma/                    # Database schema, migrations, and seeds
│   ├── migrations/            # Version-controlled SQL migrations
│   ├── schema.prisma          # Prisma schema definition
│   └── seed.ts                # Idempotent database seeder (2 sites, 10 assets, 20 tickets, 3 users)
├── src/                       # Application source code
│   ├── controllers/           # HTTP request handlers
│   ├── db/                    # Prisma client singleton
│   ├── middleware/            # Auth, validation, and centralized error handling
│   ├── routes/                # Express router modular definitions
│   ├── types/                 # Custom TypeScript definitions
│   ├── utils/                 # JWT and password helper utilities
│   ├── validators/            # Zod validation schemas
│   ├── app.ts                 # Express application setup & middleware assembly
│   └── server.ts              # Server bootstrap & graceful shutdown logic
├── tests/                     # Integration and unit tests
│   ├── assets.test.ts         # Assets CRUD, search, filter, pagination tests
│   ├── auth.test.ts           # Authentication & role protection tests
│   ├── comments.test.ts       # Ticket comments tests
│   ├── dashboard.test.ts      # Dashboard aggregation & overdue calculation tests
│   ├── db.test.ts             # Referential integrity & schema constraint tests
│   ├── setup.test.ts          # Environment and tooling tests
│   ├── sites.test.ts          # Sites CRUD and restriction tests
│   └── tickets.test.ts        # Tickets workflow, permissions, and reopen tests
├── .env.example               # Safe environment variable template
├── package.json               # Dependencies and execution scripts
├── tsconfig.json              # Strict TypeScript compiler options
└── tsconfig.build.json        # Production build configuration excluding tests
```

---

## System Requirements

- **Node.js**: `v20.x` LTS or higher (verified compatible through Node 26 LTS).
- **npm**: `v10.x` or higher.
- **PostgreSQL**: `v14.0` or higher running locally or in Docker.

Check installed versions:

```bash
node -v
npm -v
```

---

## Environment Configuration

Configuration is managed via environment variables. Copy the provided `.env.example` template to `.env`:

```bash
cp .env.example .env
```

### Environment Variables Reference

| Variable         | Description                                            | Default / Example                                                      |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `PORT`           | Local HTTP listening port                              | `5000`                                                                 |
| `NODE_ENV`       | Environment mode (`development`, `test`, `production`) | `development`                                                          |
| `DATABASE_URL`   | PostgreSQL connection string                           | `postgresql://postgres:postgres@localhost:5432/famt_dev?schema=public` |
| `JWT_SECRET`     | Secret key used to sign and verify JSON Web Tokens     | `your-secret-key-min-32-chars`                                         |
| `JWT_EXPIRES_IN` | Token validity duration                                | `24h`                                                                  |
| `CORS_ORIGIN`    | Allowed client origin for CORS                         | `http://localhost:5173`                                                |

> [!CAUTION]
> **Security Notice**: Never commit `.env` to Git. The `.gitignore` file strictly excludes `.env`. Only `.env.example` with sanitized placeholders is committed.

---

## Local Setup & Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd FAMT_Backend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure PostgreSQL database**:
   Ensure PostgreSQL is running locally and create the database:

   ```bash
   createdb famt_dev
   # Or via psql:
   # CREATE DATABASE famt_dev;
   ```

4. **Run migrations and seed the database**:

   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```
   The server will start listening at `http://localhost:5000`.

---

## Database Migrations & Seeding

### Migrations

Database schemas are managed using version-controlled Prisma migrations located in `prisma/migrations/`.

- Apply migrations locally:
  ```bash
  npm run prisma:migrate
  ```
- Generate Prisma Client types:
  ```bash
  npm run prisma:generate
  ```

### Seeding

The database seed script (`prisma/seed.ts`) is completely idempotent and seeds:

- **3 Users** (one per required role):
  - **Admin**: `admin@famt.dev` / `Password123!`
  - **Technician**: `tech@famt.dev` / `Password123!`
  - **Viewer**: `viewer@famt.dev` / `Password123!`
- **2 Sites**:
  - `Plant Alpha` (North Industrial Zone)
  - `Facility Bravo` (West Industrial Corridor)
- **10 Industrial Assets** across various types (Pumps, Motors, Compressors, Transformers, Chillers).
- **20 Maintenance Tickets** covering all statuses (`Open`, `In progress`, `Resolved`, `Closed`) and priorities (`Low`, `Medium`, `High`, `Critical`), with exact overdue tickets for dashboard metric verification.
- **2 Ticket Comments** establishing thread communication.

Run seeding at any time:

```bash
npm run prisma:seed
```

---

## Available NPM Scripts

| Script                    | Command                                               | Purpose                                                        |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`             | `ts-node src/server.ts`                               | Starts the development server with live TypeScript compilation |
| `npm run build`           | `rimraf dist && tsc -p tsconfig.build.json`           | Compiles clean production JavaScript to `dist/`                |
| `npm start`               | `node dist/server.js`                                 | Runs the compiled production server                            |
| `npm run typecheck`       | `tsc --noEmit`                                        | Performs full strict TypeScript type checking without emission |
| `npm run lint`            | `eslint "src/**/*.ts" "tests/**/*.ts"`                | Runs ESLint 9 checks across source and test files              |
| `npm run lint:fix`        | `eslint ... --fix`                                    | Automatically fixes auto-fixable lint issues                   |
| `npm run format:check`    | `prettier --check ...`                                | Verifies code formatting against Prettier rules                |
| `npm run format`          | `prettier --write ...`                                | Formats all source, test, JSON, and Markdown files             |
| `npm test`                | `cross-env NODE_ENV=test jest --runInBand`            | Executes the complete integration test suite                   |
| `npm run test:coverage`   | `cross-env NODE_ENV=test jest --runInBand --coverage` | Generates detailed test coverage reports                       |
| `npm run prisma:generate` | `prisma generate`                                     | Re-generates the Prisma Client                                 |
| `npm run prisma:migrate`  | `prisma migrate dev`                                  | Applies pending migrations in development                      |
| `npm run prisma:seed`     | `ts-node prisma/seed.ts`                              | Populates the database with initial demo and baseline data     |

---

## Data Models & Schema

The database design implements strict relational integrity and indexing:

```mermaid
erDiagram
    User ||--o{ Ticket : creates
    User ||--o{ Ticket : assigned
    User ||--o{ Comment : writes
    Site ||--|{ Asset : contains
    Asset ||--o{ Ticket : has
    Ticket ||--o{ Comment : includes

    User {
        uuid id PK
        string email UK
        string password
        string name
        enum role "Admin | Technician | Viewer"
        datetime createdAt
        datetime updatedAt
    }

    Site {
        uuid id PK
        string name
        string location
        datetime createdAt
        datetime updatedAt
    }

    Asset {
        uuid id PK
        string name
        string type
        string serialNo UK
        enum status "Active | Under maintenance | Retired"
        uuid siteId FK
        datetime createdAt
        datetime updatedAt
    }

    Ticket {
        uuid id PK
        string title
        string description
        enum status "Open | In progress | Resolved | Closed"
        enum priority "Low | Medium | High | Critical"
        datetime dueDate
        uuid assetId FK
        uuid createdById FK
        uuid assigneeId FK
        datetime createdAt
        datetime updatedAt
    }

    Comment {
        uuid id PK
        string body
        uuid ticketId FK
        uuid userId FK
        datetime createdAt
        datetime updatedAt
    }
```

### Relational Integrity Rules

1. **Site -> Assets**: `onDelete: Restrict`. A site cannot be deleted while assets remain linked to it.
2. **Asset -> Tickets**: `onDelete: Restrict`. An asset cannot be deleted while maintenance tickets exist for it.
3. **Composite Index**: An explicit composite index on `Ticket(status, assignee_id)` optimizes high-volume dashboard and technician queue queries.

---

## Role-Based Access Control (RBAC)

The application implements three discrete roles:

1. **Admin**:
   - Full CRUD over Sites, Assets, and Tickets.
   - User role promotions (e.g. creating Technicians or new Admins).
   - Exclusive authority to close tickets and reopen previously closed tickets.
2. **Technician**:
   - Read access to Sites, Assets, and Tickets.
   - Create tickets and add comments.
   - Update tickets assigned to them.
   - Transition ticket status (`Open` -> `In progress` -> `Resolved`).
   - Blocked from deleting Sites/Assets and blocked from reopening Closed tickets.
3. **Viewer**:
   - Read access to Sites, Assets, and Tickets.
   - Allowed to submit new maintenance tickets and post comments.
   - Blocked from modifying sites, assets, ticket statuses, or deleting resources.

---

## Maintenance Ticket Lifecycle & Workflow

The status transition state machine follows industrial field operations protocols:

```
[Open]  <-------- (Only Admin can reopen) <-------- [Closed]
  │                                                   ▲
  ▼                                                   │
[In progress] ───────────────────────────> [Resolved] ┘
  (Technician / Admin)     (Technician / Admin)     (Admin closes)
```

- **Open -> In progress**: Handled by assigned Technician or Admin when work begins.
- **In progress -> Resolved**: Handled by assigned Technician or Admin upon completing repairs.
- **Resolved -> Closed**: Handled by Admin upon formal quality verification.
- **Closed -> Open (Reopening Rule)**: Strictly restricted to **Admin** role. If a Technician attempts to move a Closed ticket back to Open or In progress, the API responds with HTTP 403:
  ```json
  { "error": "Only Admin can reopen a closed ticket" }
  ```

---

## API Documentation & Postman Collection

- Complete API specification with request/response schemas: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).
- Postman Collection: [`postman/FAMT_Backend.postman_collection.json`](postman/FAMT_Backend.postman_collection.json).
- Postman Environment: [`postman/FAMT_Local.postman_environment.json`](postman/FAMT_Local.postman_environment.json).
- Postman Execution Guide: [`postman/README.md`](postman/README.md).

### Quick Summary of Endpoints

| Method   | Endpoint                    | Access           | Purpose                                                                     |
| -------- | --------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `POST`   | `/api/auth/register`        | Public / Admin   | User registration (default `Viewer`; Admin JWT required for elevated roles) |
| `POST`   | `/api/auth/login`           | Public           | Authenticate user and issue JWT                                             |
| `GET`    | `/api/auth/me`              | Authenticated    | Retrieve profile of current logged-in user                                  |
| `POST`   | `/api/auth/logout`          | Public           | Stateless logout notification                                               |
| `GET`    | `/api/sites`                | Authenticated    | List all sites with asset count aggregations                                |
| `GET`    | `/api/sites/:id`            | Authenticated    | Retrieve site by UUID                                                       |
| `POST`   | `/api/sites`                | Admin            | Create a new site                                                           |
| `PUT`    | `/api/sites/:id`            | Admin            | Update site name/location                                                   |
| `DELETE` | `/api/sites/:id`            | Admin            | Delete empty site (blocked if site has assets)                              |
| `GET`    | `/api/assets`               | Authenticated    | List assets (search, status/site filters, deterministic pagination)         |
| `GET`    | `/api/assets/:id`           | Authenticated    | Retrieve asset by UUID with site relation                                   |
| `POST`   | `/api/assets`               | Admin            | Create asset linked to site                                                 |
| `PUT`    | `/api/assets/:id`           | Admin            | Update asset fields                                                         |
| `DELETE` | `/api/assets/:id`           | Admin            | Delete asset (blocked if asset has tickets)                                 |
| `GET`    | `/api/tickets`              | Authenticated    | List tickets with filters (`status`, `priority`, `assigneeId`, pagination)  |
| `GET`    | `/api/tickets/:id`          | Admin / Assignee | Retrieve ticket with relations (Admin or assigned Technician only)          |
| `POST`   | `/api/tickets`              | Authenticated    | Create maintenance ticket                                                   |
| `PUT`    | `/api/tickets/:id`          | Admin / Assignee | Update ticket details                                                       |
| `PATCH`  | `/api/tickets/:id/status`   | Admin / Tech     | Update status (`Open`->`In progress`->`Resolved`; Admin only for reopen)    |
| `GET`    | `/api/tickets/:id/comments` | Authenticated    | List comments for ticket thread                                             |
| `POST`   | `/api/tickets/:id/comments` | Authenticated    | Add comment to ticket thread                                                |
| `GET`    | `/api/dashboard/summary`    | Authenticated    | Calculate real-time database summary aggregations                           |
| `GET`    | `/api/health`               | Public           | Service health and uptime check                                             |
| `GET`    | `/api/test-admin-access`    | Admin            | RBAC verification test endpoint                                             |

---

## Testing & Quality Verification

The test suite runs 126 automated tests across 8 test suites with zero manual intervention required:

```bash
npm test
```

### Test Coverage Highlights

- **Referential Integrity (`tests/db.test.ts`)**: Confirms unique constraints and `RESTRICT` cascade rules for sites with assets and assets with tickets.
- **Authentication (`tests/auth.test.ts`)**: Covers registration policies, password hashing, token verification, role enforcement, and token expiry.
- **Sites API (`tests/sites.test.ts`)**: Tests Admin CRUD, non-admin 403 rejections, UUID validation, and deletion restrictions.
- **Assets API (`tests/assets.test.ts`)**: Tests search filtering, site filtering, duplicate serial number 400 rejection, and deterministic pagination.
- **Tickets API (`tests/tickets.test.ts`)**: Tests ticket lifecycle transitions, role restrictions, assignee role validation, and Admin reopen rules.
- **Comments API (`tests/comments.test.ts`)**: Tests comment thread creation, author attribution, and validation.
- **Dashboard API (`tests/dashboard.test.ts`)**: Tests all KPI aggregations (`openTickets`, `overdueTickets`, `assetsUnderMaintenance`), empty database handling, and breakdown groupings.

To run all quality assurance checks:

```bash
npm run typecheck       # Strict TypeScript typechecking
npm run lint            # ESLint 9 checks
npm run format:check    # Prettier formatting check
npm run build           # Production TypeScript build
```

---

## Production Deployment

Complete deployment guides for cloud hosting platforms:

- **Render & Railway Deployment**: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Quick production build & migration deployment commands:

```bash
# Build production bundle
npm run build

# Deploy pending migrations safely to production database
npx prisma migrate deploy

# Start production server
npm start
```

---

## Assignment Compliance Summary

| Requirement Category       | Specification                                              | Implementation Evidence                                                  |  Status  |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | :------: |
| **Language & Runtime**     | Node.js 20 LTS, TypeScript (strict mode, zero `any`)       | `tsconfig.json` (`strict: true`, `noImplicitAny: true`), Node 20+ engine | **PASS** |
| **Framework & Database**   | Express 4, PostgreSQL, Prisma ORM 5                        | `src/app.ts`, `prisma/schema.prisma`                                     | **PASS** |
| **Data Models (5)**        | `User`, `Site`, `Asset`, `Ticket`, `Comment`               | `prisma/schema.prisma` with enums, foreign keys, timestamps              | **PASS** |
| **Indexes & Foreign Keys** | Composite index on `Ticket(status, assignee_id)`           | Defined in Prisma schema: `@@index([status, assigneeId])`                | **PASS** |
| **Seed Data**              | 2 sites, 10 assets, 20 tickets, 1 user per role            | `prisma/seed.ts` (idempotent, bcrypt passwords)                          | **PASS** |
| **Authentication**         | JWT with bcrypt, `requireAuth`, `requireRole`              | `src/middleware/auth.middleware.ts`, `src/utils/jwt.ts`                  | **PASS** |
| **Sites CRUD**             | Admin write, authenticated read, protect deletions         | `src/controllers/site.controller.ts`, `tests/sites.test.ts`              | **PASS** |
| **Assets CRUD**            | Search, status/site filters, deterministic pagination      | `src/controllers/asset.controller.ts`, `tests/assets.test.ts`            | **PASS** |
| **Tickets Workflow**       | Tech transitions, Admin close & reopen rule                | `src/controllers/ticket.controller.ts`, `tests/tickets.test.ts`          | **PASS** |
| **Comments Threading**     | Chronological comments with author relation                | `src/controllers/comment.controller.ts`, `tests/comments.test.ts`        | **PASS** |
| **Dashboard Summary**      | Real-time DB aggregations (`open`, `overdue`, etc.)        | `src/controllers/dashboard.controller.ts`, `tests/dashboard.test.ts`     | **PASS** |
| **Overdue Definition**     | `dueDate < NOW()` AND `status IN (Open, In progress)`      | Handled via Prisma query in `dashboard.controller.ts`                    | **PASS** |
| **Validation & Errors**    | Zod validation with strict rejection of extra/empty fields | `src/validators/*.validator.ts`, centralized error middleware            | **PASS** |
| **Git & Branching**        | Clean task branches, never commit to `main`                | Structured branches (`feature/api-docs-deployment`)                      | **PASS** |
| **Postman Artifacts**      | Importable v2.1.0 collection & environment                 | `postman/FAMT_Backend.postman_collection.json`                           | **PASS** |
