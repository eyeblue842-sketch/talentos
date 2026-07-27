# Careeriz / TalentOS

Careeriz is an MVP SaaS hiring platform that combines job posting, resume search, ATS workflow, and a candidate resume builder in one product.

## Monorepo Structure

```text
Careeriz/
  frontend/   Next.js 15 + Tailwind SaaS dashboard
  backend/    Express + Prisma + PostgreSQL + Elasticsearch-ready APIs
  docs/       API documentation and architecture notes
```

## Core Features

- Role-based authentication for recruiters and candidates
- Recruiter job management with open/closed status
- Resume database search with Elasticsearch-backed recruiter search
- ATS board with pipeline updates, notes, scheduling, and email trigger stubs
- Candidate resume builder with autosave-friendly JSON sections and PDF-ready templates
- Candidate job browsing, one-click apply, and application status tracking
- Recruiter and candidate dashboards with summary cards and recent activity
- Local file storage abstraction for resumes, ready to swap to S3
- Basic AI-style keyword matching score for jobs and resumes

## Tech Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Node.js, Express, Prisma ORM
- Database: PostgreSQL
- Search: Elasticsearch
- Auth: JWT
- File Storage: local disk by default, S3-ready abstraction

## Quick Start

### 1. Install prerequisites

- Node.js 20+
- PostgreSQL 15+
- Elasticsearch 8+ (optional for local development, required where recruiter resume search must be available)

### 2. Install dependencies

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 3. Configure environment

Copy:

- `backend/.env.example` to `backend/.env`
- `frontend/.env.example` to `frontend/.env.local`

Frontend local auth values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
BACKEND_API_BASE_URL=http://127.0.0.1:5000/api
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT=true
NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING=true
```

Backend local auth values:

```env
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://127.0.0.1:5000
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

For local development without Elasticsearch, add:

```env
ELASTICSEARCH_ENABLED=false
```

Local candidate and recruiter workflows unrelated to resume search will continue to work, but recruiter resume search will return `503 Resume search is temporarily unavailable.`

To enable recruiter resume search, set:

```env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_URL=http://localhost:9200
```

Do not disable Elasticsearch in production unless resume search is intentionally unavailable there.

### 4. Set up the database

```bash
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
npm run seed
```

### 5. Run locally

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:5000/api`

Production standalone frontend start:

```bash
npm run build --prefix frontend
npm run start --prefix frontend
```

This uses `node .next/standalone/server.js`.

## Bulk Resume Import

The bulk resume import module is available to recruiters and administrators when `NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT=true`.

Frontend routes:

- `/recruiter/candidates/import`
- `/recruiter/candidates/import/history`
- `/recruiter/candidates/import/:batchId`
- `/recruiter/candidates/import/:batchId/items/:itemId`
- `/admin/candidates/import`
- `/admin/candidates/import/history`

Current recruiter workflow:

1. Upload multiple PDF, DOC, or DOCX files, or one ZIP archive.
2. Receive a batch reference immediately after upload acceptance.
3. Monitor item processing from the batch detail screen.
4. Review parsed candidate fields and confidence signals.
5. Confirm candidate creation, reject unusable items, or retry failed items.
6. Resolve duplicate candidates by skipping, attaching to an existing profile, updating empty fields, or explicitly creating a separate candidate.
7. Download failure CSV reports and protected original resumes when needed.

Operational notes:

- Frontend validation improves UX but backend validation remains authoritative.
- ZIP uploads cannot be combined with individual resume files in one submission.
- Secure resume access always goes through protected backend endpoints or short-lived presigned URLs.
- When `NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING=false`, the review flow shows manual-review messaging instead of AI confidence guidance.
- Upload limits are controlled by backend environment variables such as `RESUME_IMPORT_MAX_FILES`, `RESUME_MAX_FILE_SIZE_MB`, `RESUME_IMPORT_MAX_ZIP_SIZE_MB`, and `RESUME_IMPORT_MAX_UNCOMPRESSED_MB`.

## Deployment Targets

- Frontend: Vercel or Netlify
- Backend: Render, Railway, ECS, DigitalOcean, or any Node host
- Storage: local during MVP, S3 in production

## Notes

- Rotate any previously exposed Google OAuth client secret in Google Cloud Console before reusing this integration.
- Resume PDF generation is modeled via structured template data and backend PDF endpoint wiring.
- Elasticsearch is explicitly controlled by `ELASTICSEARCH_ENABLED`. When disabled, recruiter resume search is unavailable instead of falling back to PostgreSQL filtering.
