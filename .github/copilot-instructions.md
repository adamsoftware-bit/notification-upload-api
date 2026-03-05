# Copilot Instructions

## Project Overview

Node.js/Express REST API for the Alcaldía de Pueblo Nuevo. Handles document management, email notifications, Excel report generation, and employee access-log queries. Uses CommonJS (`"type": "commonjs"`).

## Architecture & Service Boundaries

All HTTP routes are registered in `src/index.js`. Business logic lives in dedicated service files:

| File                         | Responsibility                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `src/fileService.js`         | Local filesystem file storage, organized by `radicado`                          |
| `src/gmailSender.js`         | Nodemailer SMTP wrapper — instantiate per request with credentials              |
| `src/notificationService.js` | Daily scheduled job (`node-schedule`) to email users about expiring cases       |
| `src/reportService.js`       | Generates `.xlsx` reports from Supabase using ExcelJS                           |
| `src/logService.js`          | Queries MySQL `hik` DB for HikVision access-control logs; exported as singleton |

## Data Stores

- **Supabase (PostgreSQL)** — `cases`, `dependencies`, `case_type`, `users`, `responses` tables. Used via `@supabase/supabase-js` client initialized with `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
- **MySQL (`hik` database)** — `log` table with HikVision employee access records. Accessed via `logService` singleton using a `mysql2/promise` pool.
- **Cloudinary** — legacy file storage for the `/upload-pdf`, `/download-file/:radicado`, `/delete-file/:radicado` endpoints (still active, not to be removed).
- **Local filesystem** — new primary file storage under `uploads/radicados/{radicado}/`. Path controlled by `BASE_UPLOAD_DIR` env var (defaults to `src/uploads` in dev, `/app/uploads` in Docker).

## Dual File Storage — Important Pattern

Two parallel sets of file endpoints coexist:

- **Legacy Cloudinary routes** (`POST /upload-pdf`, `GET /download-file/:radicado`, `DELETE /delete-file/:radicado`) — upload to Cloudinary, serve from CDN URLs.
- **New local filesystem routes** (`/files/*`) — delegated to `fileService`. Multer writes temp files to `BASE_UPLOAD_DIR`, then `fileService.saveFiles` moves them to `BASE_UPLOAD_DIR/radicados/{radicado}/`.

When adding file-related features, use the `/files/*` pattern backed by `fileService`.

## Key Business Concept: `radicado`

`radicado` is the primary case-tracking identifier used throughout. Files are stored at `uploads/radicados/{radicado}/`. It appears as a route param (`:radicado`) and a `req.body` field in upload requests.

## Scheduled Notification Job

`src/notificationService.js` exports `checkExpiringCases()`, scheduled in `src/index.js` to fire daily at **13:00 server time**:

```js
schedule.scheduleJob('0 13 * * *', async () => { ... });
```

The function checks cases expiring in **1, 3, and 5 days** (Colombia timezone `America/Bogota`) and sends HTML emails via `GmailSender`.

## Environment Variables

```
SUPABASE_URL, SUPABASE_ANON_KEY
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
PRIVATE_CLOUDINARY_CLOUD_NAME, PRIVATE_CLOUDINARY_API_KEY, PRIVATE_CLOUDINARY_API_SECRET
MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT
BASE_UPLOAD_DIR          # absolute path to uploads root (Docker: /app/uploads)
UPLOADS_PATH             # host path mounted into Docker container
VITE_FRONTEND_URL        # used to build case deep-links in notification emails
PORT                     # defaults to 3001
```

## Developer Workflows

```bash
# Install dependencies (pnpm only)
pnpm install

# Run locally
node src/index.js

# Build & run with Docker
docker-compose up -d --build

# View logs
docker-compose logs -f notification-api
```

`pnpm-lock.yaml` is committed; always use `pnpm`, never `npm install`.

## Temporary Files & Cleanup

Multer stages uploads to `BASE_UPLOAD_DIR` (or `src/uploads/` in dev). `fileService.saveFiles` copies each file to its radicado folder and calls `fs.unlinkSync` on the temp file. `reportService` writes xlsx to `./temp/` and deletes the directory on each new report run.

## Authentication

This API has **no authentication middleware**. All endpoints are open. Do not add JWT, API key, or session guards unless explicitly requested.

## Response Conventions

- Successful list/query responses: `{ success: true, data: [...], pagination: {...} }`
- Successful file operations: `{ message: "...", results: [...] }`
- Errors: `res.status(5xx).json({ success: false, error: "...", message: error.message })`
- Simple endpoints (email, report download) use plain string responses or `res.download()`.
