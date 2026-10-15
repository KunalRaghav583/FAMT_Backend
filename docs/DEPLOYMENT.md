# Field Asset Maintenance Tracker (FAMT) — Production Deployment Guide

This guide describes how to deploy the FAMT Backend API to production platforms such as **Render** or **Railway** using managed PostgreSQL.

---

## 1. Prerequisites & Architecture Overview

The FAMT Backend is a production-grade Node.js/TypeScript Express service that connects to a PostgreSQL database via Prisma ORM.

### Architecture Components

- **Web Service**: Node.js 20 LTS runtime executing compiled JavaScript (`dist/server.js`).
- **Database**: Managed PostgreSQL (v14+) with SSL support.
- **Environment**: Configured entirely through standard environment variables.

---

## 2. Production Environment Variables

Configure the following environment variables in your deployment dashboard. **Never commit actual production values to version control.**

| Variable         | Description                  | Example / Recommended Value                                  |
| ---------------- | ---------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`       | Application environment mode | `production`                                                 |
| `PORT`           | Listening HTTP port          | `5000` (or platform default `$PORT`)                         |
| `DATABASE_URL`   | PostgreSQL connection string | `postgresql://user:pass@host:5432/famt_prod?sslmode=require` |
| `JWT_SECRET`     | Secret key for signing JWTs  | Generate using `openssl rand -hex 32`                        |
| `JWT_EXPIRES_IN` | JWT token lifetime           | `24h`                                                        |
| `CORS_ORIGIN`    | Allowed frontend origin      | `https://famt.yourdomain.com` (or comma-separated)           |

---

## 3. Deployment Option A: Render

### Step 1: Provision Managed PostgreSQL

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**.
3. Set the Name (e.g. `famt-postgres-prod`).
4. Select the Region closest to your users.
5. Choose the **Free** or appropriate paid tier.
6. Click **Create Database**.
7. Once created, copy the **Internal Database URL** (for services running on Render) or **External Database URL**.

### Step 2: Deploy the Web Service

1. In the Render Dashboard, click **New +** -> **Web Service**.
2. Connect your Git repository (`FAMT_Backend`).
3. Configure the service settings:
   - **Name**: `famt-backend`
   - **Region**: Match the database region.
   - **Branch**: `main` (or designated release branch).
   - **Runtime**: `Node` (Node.js 20 LTS).
   - **Build Command**:
     ```bash
     npm ci && npm run build && npx prisma migrate deploy
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
4. Add the **Environment Variables** in the Render settings:
   - `DATABASE_URL`: Paste the database connection string from Step 1.
   - `JWT_SECRET`: Secure 64-character hexadecimal string.
   - `JWT_EXPIRES_IN`: `24h`
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: Your frontend domain.
5. Click **Create Web Service**.

---

## 4. Deployment Option B: Railway

### Step 1: Provision PostgreSQL

1. Log in to [Railway](https://railway.app).
2. Create a **New Project** and select **Provision PostgreSQL**.
3. Railway automatically creates the database and populates the `DATABASE_URL` environment variable.

### Step 2: Deploy Web Service

1. In the same Railway project, click **New** -> **GitHub Repo** and select `FAMT_Backend`.
2. Go to **Variables** tab and set:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (Railway reference variable).
   - `JWT_SECRET`: Secure generated secret.
   - `JWT_EXPIRES_IN`: `24h`
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: Your frontend URL.
3. In **Settings** -> **Build & Deploy**:
   - **Build Command**: `npm ci && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm start`
4. Railway will automatically deploy the service upon push.

---

## 5. Database Migration & Seeding in Production

### Production Migration Policy

- Always run `npx prisma migrate deploy` during the build or release phase.
- **NEVER** run `prisma migrate dev` or `prisma db push` in production. `prisma migrate deploy` executes pending migrations safely without generating new migrations or prompting for schema resets.

### Initial Database Seeding (Optional)

If deploying to a fresh staging environment and you wish to seed baseline roles and demo data:

1. Connect via the platform CLI (e.g. `render-cli` or `railway run`):
   ```bash
   npm run prisma:seed
   ```
2. For live production environments, register the initial Administrator account using the `POST /api/auth/register` flow or a secure one-off admin setup script.

---

## 6. Post-Deployment Verification & Smoke Tests

After deployment succeeds, verify all components with these smoke tests:

### 1. Health Check

```bash
curl -X GET https://<your-service-url>/api/health
```

**Expected Response**:

```json
{ "status": "ok", "timestamp": "2026-10-15T..." }
```

### 2. User Authentication

```bash
curl -X POST https://<your-service-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@famt.com","password":"YourAdminPassword!"}'
```

**Expected Response**: HTTP 200 with JWT token.

### 3. Dashboard Metrics

```bash
curl -X GET https://<your-service-url>/api/dashboard/summary \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_2>"
```

**Expected Response**: HTTP 200 with summary metrics object.

---

## 7. Production Security Best Practices

1. **Database SSL**: Ensure `DATABASE_URL` contains `?sslmode=require` for encrypted connections.
2. **CORS Restrictions**: Do not set `CORS_ORIGIN="*"` in production. Specify exact domain origins (e.g. `https://famt.example.com`).
3. **Secret Rotation**: Rotate `JWT_SECRET` periodically; invalidating older tokens gracefully.
4. **Least Privilege**: The database user should only have privileges over the `famt` schema.
5. **No Secrets in Version Control**: Ensure `.env` is never committed; use `.env.example` as the single template.
