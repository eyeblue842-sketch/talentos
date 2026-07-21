# System Architecture

## Overview

Careeriz is a multi-tenant recruitment platform with four primary runtime surfaces:

- public website and job discovery
- candidate workspace
- recruiter and interviewer workspace
- enterprise administration workspace

The platform is organized around a shared Express backend, a Next.js App Router frontend, Prisma/PostgreSQL persistence, Redis-backed operational services, and a background worker runtime.

## Runtime Layers

- Frontend: `frontend/`, Next.js 16, App Router, server components plus client-side interaction for workflow actions.
- Backend API: `backend/src/app.js`, modular route/controller/service architecture.
- Shared contracts: `shared/`, shared Zod schemas and validation contracts.
- Data layer: Prisma schema in `backend/prisma/schema.prisma`.
- Worker runtime: `backend/src/worker.js`, persisted background tasks plus retry/dead-letter behavior.

## Core Domains

- authentication and session security
- first-run installation bootstrap and setup state
- organization, membership, and RBAC
- jobs, requisitions, and ATS applications
- candidate profile and resume assets
- interview lifecycle and interview scheduling
- offers and joining lifecycle
- enterprise administration
- intelligence, analytics, and release hardening

## Initial Setup Architecture

Milestone 9 adds a bootstrap layer for fresh installations:

- `PlatformSetupState` stores whether the system has been initialized
- `backend/src/services/setupService.js` owns setup status, completion, and reset rules
- `frontend/app/setup/page.jsx` renders the one-time setup wizard
- public/auth entry pages server-redirect to `/setup` only when initialization is missing

The setup wizard creates the first organization and first super administrator by reusing existing organization, membership, role-definition, settings, feature-flag, and audit services.

## Meeting and Scheduling Architecture

Milestone 8.5 extends the interview domain without introducing a parallel workflow system:

- `InterviewRound` remains the canonical ATS interview round.
- `InterviewMeeting` stores schedule and provider state for a round.
- `MeetingParticipant` stores explicit candidate and interviewer participation.
- `InterviewRescheduleRequest` and `InterviewRescheduleOption` model candidate/interviewer reschedule requests.
- `InterviewScheduleHistory` records append-only schedule changes.
- `MeetingReminder` links reminder intent to background tasks.
- `MeetingProviderConnection` stores encrypted organization-scoped Google or Zoom OAuth connections.

Scheduling logic is centralized in `backend/src/meeting/meetingService.js`. Controllers and routes only validate/authenticate and delegate.

## Provider Integration Boundary

Meeting providers are abstracted behind `backend/src/meeting/providers/`:

- `GoogleMeetProvider`
- `ZoomProvider`
- `CustomMeetingProvider`
- `meetingProviderFactory`

No controller calls Google or Zoom directly. Provider adapters normalize errors and operate on validated, redacted meeting payloads.

## Security and Isolation

- Organization scoping is enforced in backend services before every write.
- Meeting provider connections are organization-scoped and encrypted at rest.
- Candidate and interviewer meeting views are permission-filtered and do not expose host URLs, tokens, or internal notes.
- Audit logging records provider connection, schedule, reschedule, reminder, and cancellation events.

## Background Automation

Milestone 8 introduced persisted background tasks. Milestone 8.5 reuses that system for:

- interview reminders
- retry-safe reminder cancellation/rescheduling
- future provider retry hooks

See `BACKGROUND_TASK_ARCHITECTURE.md`.

## Deployment Topology

Careeriz is prepared for Dockerized deployment with:

- frontend container
- backend API container
- worker container
- PostgreSQL
- Redis
- Elasticsearch

Docker assets exist in the repository, but Docker runtime validation could not be performed in this environment because Docker CLI is unavailable.
