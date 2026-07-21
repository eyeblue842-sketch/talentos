# System Architecture

## Overview

Careeriz is a multi-tenant recruitment platform with three primary application surfaces:

- public and access pages
- candidate workspace
- recruiter and enterprise administration workspace

## Frontend

- framework: Next.js 16 App Router
- language: JavaScript with TypeScript checking
- patterns: server-rendered route pages plus client components for interactive workflows
- shells: shared workspace shells for recruiter, candidate, and admin navigation consistency

## Backend

- framework: Express
- API style: modular route/controller/service pattern
- validation: shared Zod schemas plus existing backend validation utilities
- tenancy: organization-scoped access checks and permission helpers

## Data Layer

- database: PostgreSQL-oriented Prisma schema
- ORM: Prisma
- migrations: additive milestone-based migrations in `backend/prisma/migrations`

## Core Domain Areas

- auth and session hardening
- organization and membership management
- jobs and requisitions
- resume assets and candidate profiles
- ATS applications and pipeline
- interview lifecycle
- offer lifecycle
- enterprise administration
- centralized intelligence and analytics

## Shared Services

- audit logging
- notifications
- organization access
- feature flags
- enterprise permissions
- health and observability

## Intelligence Architecture

Milestone 7 adds a centralized intelligence layer. See `CAREERIZ_INTELLIGENCE_ARCHITECTURE.md` for detailed design.

## Background Automation

Milestone 8 turns the background-task model into a real worker runtime:

- `backend/src/worker.js`
- persisted `BackgroundTask` records
- Redis wakeups
- scheduler loop
- retry and dead-letter handling

See `BACKGROUND_TASK_ARCHITECTURE.md`.

## Deployment Topology

Milestone 8 standardizes:

- Dockerized backend
- Dockerized worker
- Dockerized frontend
- Redis
- PostgreSQL
- Elasticsearch

See `DEVOPS_ARCHITECTURE.md` and `DOCKER_GUIDE.md`.
