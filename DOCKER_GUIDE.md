# Docker Guide

## Files

- `backend/Dockerfile`
- `backend/Dockerfile.worker`
- `frontend/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

## Local Production Stack

Run:

```bash
docker compose up --build
```

Services:

- postgres
- redis
- elasticsearch
- backend
- worker
- frontend

## Health Checks

The compose stack includes health checks for:

- PostgreSQL
- Redis
- Elasticsearch
- backend
- frontend

## Persistent Volumes

- `postgres_data`
- `redis_data`
- `elastic_data`
- `resume_storage`

## Notes

- the worker uses the same codebase as the backend but runs `src/worker.js`
- the frontend uses Next.js standalone output for a smaller runtime image
- the backend and worker images run Prisma client generation during build
