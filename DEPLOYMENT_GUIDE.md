# Deployment Guide

## Scope

This guide prepares Careeriz for staging or production-style deployment. It does not perform deployment automatically.

## Recommended Host

- Ubuntu 22.04 or newer
- Docker Engine
- Docker Compose plugin
- Nginx
- TLS certificate management such as Let's Encrypt

## Services

- frontend
- backend
- worker
- PostgreSQL or managed Supabase/PostgreSQL
- Redis
- Elasticsearch

## Environment Preparation

1. Copy `.env.example` and set deployment values.
2. Set a strong `JWT_SECRET`.
3. Set valid `FRONTEND_URL`, `BACKEND_URL`, and `CORS_ALLOWED_ORIGINS`.
4. Set `DATABASE_URL` and `DIRECT_URL`.
5. Set `REDIS_URL`.
6. Set SMTP credentials if transactional email is required.
7. Set storage provider credentials when using S3.
8. Keep intelligence provider keys server-side only.

## Docker Deployment

1. Build images:
   - `docker build -f backend/Dockerfile .`
   - `docker build -f backend/Dockerfile.worker .`
   - `docker build -f frontend/Dockerfile .`
2. Start the stack:
   - `docker compose up -d`
3. Run Prisma migration deployment from the backend container before opening traffic.
4. Confirm health:
   - backend `/api/health`
   - Redis
   - Elasticsearch
   - worker logs

## Nginx

Recommended reverse-proxy pattern:

- `app.example.com` -> frontend container
- `api.example.com` -> backend container

Ensure:

- TLS enforced
- `X-Forwarded-*` headers passed through
- request size matches upload policy
- websocket and keepalive settings remain compatible if later needed

## Staging Notes

- enable Redis
- enable worker
- test SMTP with a safe sandbox mailbox
- test Elasticsearch indexing
- verify browser authentication and protected-route flows

## Rollback

- roll back containers to the previous image tag
- roll back schema only through reviewed non-destructive migrations
- restore database or object storage from backup if required

## Post-Deploy Validation

- API health
- frontend health
- recruiter login
- candidate login
- worker task processing
- resume upload
- offer access
- resume search
- admin background-jobs page
