# Field Asset Maintenance Tracker (FAMT) — API Documentation

This document provides complete, definitive reference documentation for all REST API endpoints implemented in the FAMT Backend.

---

## 1. Overview & Conventions

### Base URL

- Local: `http://localhost:5000/api`
- Production: `https://<your-domain>/api`

### Global Request Headers

| Header          | Value                | Description                                      |
| --------------- | -------------------- | ------------------------------------------------ |
| `Content-Type`  | `application/json`   | Required for all `POST`, `PUT`, `PATCH` requests |
| `Authorization` | `Bearer <JWT_TOKEN>` | Required for all authenticated endpoints         |

### Standard Error Response Shape

All error responses adhere to a consistent JSON structure:

```json
{
  "error": "Error message description"
}
```

For Zod schema validation failures (HTTP 400), an additional `details` array is included:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "body.email",
      "message": "Invalid email address"
    }
  ]
}
```

### HTTP Status Code Conventions

- `200 OK`: Request succeeded (GET, PUT, PATCH, standard POST).
- `201 Created`: Resource successfully created (POST).
- `400 Bad Request`: Validation failure, empty body, unknown fields, invalid UUID format, or business rule violation (e.g. deleting site with assets).
- `401 Unauthorized`: Missing, invalid, or expired JWT token.
- `403 Forbidden`: Authenticated user lacks the required role or ownership permissions.
- `404 Not Found`: Resource with specified ID was not found.
- `409 Conflict`: Unique constraint violation (e.g. duplicate email or serial number).
- `500 Internal Server Error`: Unhandled server error.

---

## 2. Authentication & Authorization Architecture

### Role-Based Access Control (RBAC) Matrix

The system enforces three user roles:

1. **Admin**: Complete system access. Manages sites, assets, users, ticket assignments, status changes, and reopening closed tickets.
2. **Technician**: Maintenance operations. Can list sites/assets, view tickets, create tickets, update assigned tickets, change ticket status (`Open` -> `In progress` -> `Resolved`), and add comments. Cannot delete sites/assets or reopen closed tickets.
3. **Viewer**: Read-mostly user. Can list sites/assets, view tickets, submit new tickets, and add comments. Cannot modify sites, assets, ticket statuses, or delete resources.

| Route / Action                                  | Admin |    Technician    |  Viewer  | Unauthenticated |
| ----------------------------------------------- | :---: | :--------------: | :------: | :-------------: |
| `POST /api/auth/register` (Public / Viewer)     |  ✅   |        ✅        |    ✅    |       ✅        |
| `POST /api/auth/register` (Role promotion)      |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (403)     |
| `POST /api/auth/login`                          |  ✅   |        ✅        |    ✅    |       ✅        |
| `GET /api/auth/me`                              |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `POST /api/auth/logout`                         |  ✅   |        ✅        |    ✅    |       ✅        |
| `GET /api/sites`                                |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `POST /api/sites`                               |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `PUT /api/sites/:id`                            |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `DELETE /api/sites/:id`                         |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `GET /api/assets`                               |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `POST /api/assets`                              |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `PUT /api/assets/:id`                           |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `DELETE /api/assets/:id`                        |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `GET /api/tickets`                              |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `GET /api/tickets/:id`                          |  ✅   | ✅ (if assigned) | ❌ (403) |    ❌ (401)     |
| `POST /api/tickets`                             |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `PUT /api/tickets/:id`                          |  ✅   | ✅ (if assigned) | ❌ (403) |    ❌ (401)     |
| `PATCH /api/tickets/:id/status` (Workflow)      |  ✅   |        ✅        | ❌ (403) |    ❌ (401)     |
| `PATCH /api/tickets/:id/status` (Reopen Closed) |  ✅   |     ❌ (403)     | ❌ (403) |    ❌ (401)     |
| `GET /api/tickets/:id/comments`                 |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `POST /api/tickets/:id/comments`                |  ✅   |        ✅        |    ✅    |    ❌ (401)     |
| `GET /api/dashboard/summary`                    |  ✅   |        ✅        |    ✅    |    ❌ (401)     |

---

## 3. Endpoints Reference

### 3.1 Authentication

#### `POST /api/auth/register`

Creates a new user account.

- **Authentication**: Optional.
- **Rules**:
  - Public registration without a token creates a user with `Viewer` role by default.
  - Specifying `role: "Admin"` or `role: "Technician"` requires an active Admin Bearer token. Attempts by non-admins return `403 Forbidden`.
- **Request Body**:

```json
{
  "name": "Alex Mercer",
  "email": "alex.mercer@example.com",
  "password": "Password123!",
  "role": "Viewer"
}
```

- **Responses**:
  - `201 Created`:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "c1f7a4e8-8b2d-4d92-938b-87d25619b0aa",
    "name": "Alex Mercer",
    "email": "alex.mercer@example.com",
    "role": "Viewer",
    "createdAt": "2026-10-15T22:30:00.000Z"
  }
}
```

- `400 Bad Request`: Validation failure (name < 2 chars, invalid email, password < 6 chars).
- `403 Forbidden`: Attempting to register Admin/Technician without an Admin JWT.
- `409 Conflict`: User with this email already exists.

---

#### `POST /api/auth/login`

Authenticates a user and issues a signed JSON Web Token.

- **Authentication**: None.
- **Request Body**:

```json
{
  "email": "admin@famt.dev",
  "password": "Password123!"
}
```

- **Responses**:
  - `200 OK`:

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "d0e1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4",
    "name": "System Administrator",
    "email": "admin@famt.dev",
    "role": "Admin"
  }
}
```

- `400 Bad Request`: Missing email or password.
- `401 Unauthorized`: Invalid credentials.

---

#### `GET /api/auth/me`

Retrieves the profile of the currently authenticated user.

- **Authentication**: Required (`requireAuth`).
- **Responses**:
  - `200 OK`:

```json
{
  "user": {
    "id": "d0e1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4",
    "name": "System Administrator",
    "email": "admin@famt.dev",
    "role": "Admin",
    "createdAt": "2026-10-15T11:44:50.000Z"
  }
}
```

- `401 Unauthorized`: Missing or invalid token.

---

#### `POST /api/auth/logout`

Stateless logout informing the client to discard their JWT token.

- **Authentication**: None required.
- **Architecture Note**: FAMT uses stateless JWT authentication. Tokens expire automatically after 24 hours (configurable via `JWT_EXPIRES_IN`). This endpoint does not maintain a server-side token revocation blacklist. Clients must remove the token from client-side storage (e.g. `localStorage`, `sessionStorage`, or cookies).
- **Responses**:
  - `200 OK`:

```json
{
  "message": "Logged out successfully. Please discard your token client-side."
}
```

---

### 3.2 Sites

#### `GET /api/sites`

Returns all sites with aggregated asset counts.

- **Authentication**: Required (Any role).
- **Responses**:
  - `200 OK`:

```json
{
  "sites": [
    {
      "id": "7b0a1a2b-3c4d-5e6f-a7b8-c9d0e1f2a3b4",
      "name": "Plant Alpha",
      "location": "North Industrial Zone, Building A",
      "createdAt": "2026-10-15T11:44:50.000Z",
      "updatedAt": "2026-10-15T11:44:50.000Z",
      "_count": {
        "assets": 5
      }
    }
  ]
}
```

---

#### `GET /api/sites/:id`

Retrieves a single site by UUID.

- **Authentication**: Required (Any role).
- **URL Parameter**: `id` (must be a valid UUID).
- **Responses**:
  - `200 OK`: Site object with `_count.assets`.
  - `400 Bad Request`: `id` is not a valid UUID.
  - `404 Not Found`: Site does not exist.

---

#### `POST /api/sites`

Creates a new site.

- **Authentication**: Required (`Admin` only).
- **Request Body**:

```json
{
  "name": "Logistics Hub East",
  "location": "Sector 42, Terminal 3"
}
```

- **Responses**:
  - `201 Created`: Returns created site object.
  - `400 Bad Request`: Name or location < 2 characters, or unknown fields present.
  - `403 Forbidden`: User is Technician or Viewer.

---

#### `PUT /api/sites/:id`

Updates an existing site.

- **Authentication**: Required (`Admin` only).
- **Rules**:
  - Must provide at least one valid field (`name` or `location`).
  - Empty body `{}` or unknown extra fields are rejected with HTTP 400.
- **Responses**:
  - `200 OK`: Returns updated site.
  - `400 Bad Request`: Validation failure or empty body.
  - `403 Forbidden`: User is Technician or Viewer.
  - `404 Not Found`: Site UUID does not exist.

---

#### `DELETE /api/sites/:id`

Deletes a site.

- **Authentication**: Required (`Admin` only).
- **Referential Integrity Rule**: A site **cannot** be deleted if it contains any assets. Prisma enforces `onDelete: Restrict`.
- **Responses**:
  - `200 OK`: `{ "message": "Site deleted successfully" }`
  - `400 Bad Request`: Site contains assets (`"Cannot delete site with associated assets. Reassign or delete assets first."`).
  - `403 Forbidden`: User is Technician or Viewer.
  - `404 Not Found`: Site does not exist.

---

### 3.3 Assets

#### `GET /api/assets`

Lists assets with search, filters, and deterministic pagination.

- **Authentication**: Required (Any role).
- **Query Parameters**:
  - `search` (string, optional): Case-insensitive search on `name` or `serialNo`.
  - `siteId` (UUID string, optional): Filter by site.
  - `status` (`Active` | `Under maintenance` | `Retired`, optional).
  - `page` (integer >= 1, default `1`).
  - `limit` (integer 1-100, default `10`).
- **Deterministic Ordering**: Ordered by `createdAt: "desc"`, tie-broken by `id: "asc"`.
- **Responses**:
  - `200 OK`:

```json
{
  "assets": [
    {
      "id": "e2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c",
      "name": "Centrifugal Slurry Pump",
      "type": "Pump",
      "serialNo": "PUMP-PA-001",
      "status": "Active",
      "siteId": "7b0a1a2b-3c4d-5e6f-a7b8-c9d0e1f2a3b4",
      "createdAt": "2026-10-15T11:44:50.000Z",
      "updatedAt": "2026-10-15T11:44:50.000Z",
      "site": {
        "id": "7b0a1a2b-3c4d-5e6f-a7b8-c9d0e1f2a3b4",
        "name": "Plant Alpha",
        "location": "North Industrial Zone, Building A"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1
  }
}
```

---

#### `GET /api/assets/:id`

Retrieves a single asset with full site details.

- **Authentication**: Required (Any role).
- **Responses**:
  - `200 OK`: Asset object with embedded `site`.
  - `400 Bad Request`: Invalid UUID format.
  - `404 Not Found`: Asset UUID not found.

---

#### `POST /api/assets`

Creates a new asset.

- **Authentication**: Required (`Admin` only).
- **Request Body**:

```json
{
  "name": "Screw Compressor B-2",
  "type": "Compressor",
  "serialNo": "COMP-PB-002",
  "status": "Active",
  "siteId": "7b0a1a2b-3c4d-5e6f-a7b8-c9d0e1f2a3b4"
}
```

- **Responses**:
  - `201 Created`: Asset created.
  - `400 Bad Request`: Validation failure, invalid site UUID, or duplicate `serialNo`.
  - `403 Forbidden`: User is Technician or Viewer.
  - `404 Not Found`: Specified `siteId` does not exist.

---

#### `PUT /api/assets/:id`

Updates an existing asset.

- **Authentication**: Required (`Admin` only).
- **Request Body**: At least one field (`name`, `type`, `serialNo`, `status`, `siteId`).
- **Responses**:
  - `200 OK`: Updated asset.
  - `400 Bad Request`: Empty body, invalid UUID, unknown field, or duplicate serial number.
  - `403 Forbidden`: User is Technician or Viewer.
  - `404 Not Found`: Asset or new site UUID not found.

---

#### `DELETE /api/assets/:id`

Deletes an asset.

- **Authentication**: Required (`Admin` only).
- **Referential Integrity Rule**: An asset **cannot** be deleted if it has associated maintenance tickets (`onDelete: Restrict`).
- **Responses**:
  - `200 OK`: `{ "message": "Asset deleted successfully" }`
  - `400 Bad Request`: Asset has associated tickets (`"Cannot delete asset with associated maintenance tickets. Reassign or resolve tickets first."`).
  - `403 Forbidden`: User is Technician or Viewer.
  - `404 Not Found`: Asset UUID not found.

---

### 3.4 Tickets

#### `GET /api/tickets`

Lists tickets with filtering and pagination.

- **Authentication**: Required (Any role).
- **Query Parameters**:
  - `status` (`Open` | `In progress` | `Resolved` | `Closed`, optional).
  - `priority` (`Low` | `Medium` | `High` | `Critical`, optional).
  - `assigneeId` (UUID, optional).
  - `assetId` (UUID, optional).
  - `page` (integer >= 1, default `1`).
  - `limit` (integer 1-100, default `10`).
- **Responses**:
  - `200 OK`:

```json
{
  "tickets": [
    {
      "id": "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
      "title": "Slurry Pump Seal Leaking",
      "description": "Mechanical seal leaking fluid under operation pressure.",
      "status": "Open",
      "priority": "High",
      "dueDate": "2026-10-20T18:00:00.000Z",
      "assetId": "e2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c",
      "createdById": "d0e1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4",
      "assigneeId": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "createdAt": "2026-10-15T11:44:50.000Z",
      "updatedAt": "2026-10-15T11:44:50.000Z",
      "asset": {
        "id": "e2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c",
        "name": "Centrifugal Slurry Pump",
        "type": "Pump",
        "serialNo": "PUMP-PA-001",
        "site": {
          "id": "7b0a1a2b-3c4d-5e6f-a7b8-c9d0e1f2a3b4",
          "name": "Plant Alpha"
        }
      },
      "createdBy": {
        "id": "d0e1a2b3-c4d5-4e6f-a7b8-c9d0e1f2a3b4",
        "name": "System Administrator",
        "email": "admin@famt.dev"
      },
      "assignee": {
        "id": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "name": "Field Technician One",
        "email": "tech@famt.dev"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "totalPages": 2
  }
}
```

---

#### `GET /api/tickets/:id`

Retrieves a single ticket with full asset, site, creator, and assignee relations.

- **Authentication**: Required (`requireAuth`). Access is restricted to **Admin or the assigned Technician** per the assignment specification.
- **Responses**:
  - `200 OK`: Ticket object with relations.
  - `400 Bad Request`: Malformed UUID.
  - `403 Forbidden`: User is neither Admin nor the assigned Technician.
  - `404 Not Found`: Ticket not found.

---

#### `POST /api/tickets`

Creates a new maintenance ticket.

- **Authentication**: Required (Any authenticated user: Admin, Technician, or Viewer).
- **Rules**:
  - `createdBy` is automatically set to `req.user.id`.
  - If `assigneeId` is provided, the assigned user must have role `Technician`. Assigning to a `Viewer` or `Admin` is rejected with `400 Bad Request`.
  - `assetId` must reference a valid asset.
- **Request Body**:

```json
{
  "title": "Drive Motor Overheating",
  "description": "Bearing temperature measured at 92 degrees Celsius.",
  "priority": "Critical",
  "dueDate": "2026-10-25T12:00:00.000Z",
  "assetId": "e2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c",
  "assigneeId": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c"
}
```

- **Responses**:
  - `201 Created`: Created ticket object.
  - `400 Bad Request`: Missing required fields, invalid date format, or invalid assignee role.
  - `404 Not Found`: Asset ID does not exist.

---

#### `PUT /api/tickets/:id`

Updates ticket details.

- **Authentication**: Required.
- **Permissions**:
  - Admins can update any ticket.
  - Technicians can update tickets assigned to them.
  - Viewers receive `403 Forbidden`.
  - Reopening a `Closed` ticket requires Admin role.
- **Request Body**: At least one field (`title`, `description`, `priority`, `dueDate`, `assetId`, `assigneeId`, `status`).
- **Responses**:
  - `200 OK`: Updated ticket.
  - `400 Bad Request`: Empty body or validation error.
  - `403 Forbidden`: Permission denied or Technician attempting to reopen Closed ticket.
  - `404 Not Found`: Ticket UUID not found.

---

#### `PATCH /api/tickets/:id/status`

Updates only the status of a ticket.

- **Authentication**: Required.
- **Workflow & Reopening Rules**:
  - **Technicians** can transition: `Open` -> `In progress` -> `Resolved`.
  - **Admins** can perform any transition, including `Resolved` -> `Closed`.
  - **Only Admins can reopen a Closed ticket** (`Closed` -> `Open`). A Technician attempting to reopen a Closed ticket receives `403 Forbidden` (`"Only Admin can reopen a closed ticket"`).
  - **Viewers** cannot modify ticket status (`403 Forbidden`).
- **Request Body**:

```json
{
  "status": "In progress"
}
```

- **Responses**:
  - `200 OK`: Updated ticket object with new status.
  - `400 Bad Request`: Invalid status string.
  - `403 Forbidden`: Viewers, or Technician attempting to reopen a Closed ticket.
  - `404 Not Found`: Ticket not found.

---

### 3.5 Comments

#### `GET /api/tickets/:id/comments`

Lists all comments for a ticket in ascending chronological order.

- **Authentication**: Required (Any role).
- **Responses**:
  - `200 OK`:

```json
{
  "comments": [
    {
      "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      "body": "Initial diagnostic complete. Bearing ordered.",
      "ticketId": "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
      "userId": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
      "createdAt": "2026-10-15T12:00:00.000Z",
      "updatedAt": "2026-10-15T12:00:00.000Z",
      "user": {
        "id": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "name": "Field Technician One",
        "role": "Technician"
      }
    }
  ]
}
```

- `404 Not Found`: Ticket not found.

---

#### `POST /api/tickets/:id/comments`

Appends a new comment to a ticket thread.

- **Authentication**: Required (Any authenticated user: Admin, Technician, Viewer).
- **Rules**:
  - `userId` is automatically populated from `req.user.id`.
  - `body` must be between 1 and 2,000 characters.
- **Request Body**:

```json
{
  "body": "Parts arrived on site. Beginning installation now."
}
```

- **Responses**:
  - `201 Created`: Comment created with embedded `user` details.
  - `400 Bad Request`: Empty body or body > 2000 characters.
  - `404 Not Found`: Ticket not found.

---

### 3.6 Dashboard Summary

#### `GET /api/dashboard/summary`

Calculates real-time database aggregations for dashboard KPI cards and charts.

- **Authentication**: Required (Any role).
- **Overdue Tickets Definition**:
  - Formally defined as: `dueDate < NOW()` AND `status IN ('Open', 'In progress')`.
  - Resolved and Closed tickets are never marked overdue.
- **Aggregations Performed**:
  - `totalAssets`: Total count of all asset records.
  - `totalTickets`: Total count of all ticket records.
  - `openTickets`: Count of tickets with status `Open`.
  - `overdueTickets`: Count of unfinished tickets past their due date.
  - `assetsUnderMaintenance`: Count of assets with status `Under maintenance`.
  - `ticketsByStatus`: Breakdown across `Open`, `In progress`, `Resolved`, `Closed`.
  - `ticketsByPriority`: Breakdown across `Low`, `Medium`, `High`, `Critical`.
  - `assetsByStatus`: Breakdown across `Active`, `Under maintenance`, `Retired`.
- **Empty Database Behavior**:
  - Returns zero counts for all fields without errors.
- **Responses**:
  - `200 OK`:

```json
{
  "summary": {
    "totalAssets": 10,
    "totalTickets": 20,
    "openTickets": 6,
    "overdueTickets": 2,
    "assetsUnderMaintenance": 3,
    "ticketsByStatus": {
      "Open": 6,
      "In progress": 5,
      "Resolved": 4,
      "Closed": 5
    },
    "ticketsByPriority": {
      "Low": 4,
      "Medium": 8,
      "High": 5,
      "Critical": 3
    },
    "assetsByStatus": {
      "Active": 5,
      "Under maintenance": 3,
      "Retired": 2
    }
  }
}
```

---

### 3.7 Health & Verification

#### `GET /api/health`

Public uptime monitoring and deployment smoke test endpoint.

- **Authentication**: None.
- **Response**: `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-10-15T22:30:00.000Z"
}
```

#### `GET /api/test-admin-access`

Verification route for RBAC testing.

- **Authentication**: Required (`Admin` only).
- **Response**: `200 OK` `{ "message": "Admin access verified" }`
