# DevOps Architecture

## Runtime Topology

Careeriz Milestone 8 standardizes a deployable runtime with:

- `frontend` container
- `backend` API container
- `worker` background-processing container
- PostgreSQL
- Redis
- Elasticsearch

## Container Roles

- frontend: Next.js standalone runtime
- backend: Express API, auth, ATS, candidate, admin, intelligence APIs
- worker: background-task scheduler and processor

## Data and State

- PostgreSQL: primary system of record
- Redis: queue wakeups, distributed rate limiting, operational cache
- Elasticsearch: recruiter resume search index
- local or S3 storage: resume asset storage

## Background Task Model

The worker uses persisted `BackgroundTask` records for:

- scheduling
- retries
- dead-letter handling
- admin visibility
- idempotency

Redis is used as a wake-up queue and fast operational dependency, while PostgreSQL remains the authoritative task ledger.

## Security Layer

- env validation at startup
- JWT validation
- organization-scoped authorization
- security headers through `helmet`
- CORS allowlist
- MIME and extension checks for uploads
- rate limiting with Redis fallback to in-memory buckets

## Observability

- request correlation IDs
- structured backend logs
- worker logs
- bounded health endpoint
- queue/task-state visibility through admin background jobs

## Deployment Modes

- local production stack via `docker-compose.yml`
- staging via Ubuntu + Docker + Nginx
- production via the same topology with stricter secrets, TLS, and approvals
