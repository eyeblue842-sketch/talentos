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
- Backend: `http://localhost:5000/api`

## Deployment Targets

- Frontend: Vercel or Netlify
- Backend: Render, Railway, ECS, DigitalOcean, or any Node host
- Storage: local during MVP, S3 in production

## Notes

- Google OAuth is left as an optional extension point.
- Resume PDF generation is modeled via structured template data and backend PDF endpoint wiring.
- Elasticsearch is explicitly controlled by `ELASTICSEARCH_ENABLED`. When disabled, recruiter resume search is unavailable instead of falling back to PostgreSQL filtering.
