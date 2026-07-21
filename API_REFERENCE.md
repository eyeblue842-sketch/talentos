# API Reference

Updated: 2026-07-21

## Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/email-verification/request`
- `POST /api/auth/email-verification/confirm`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/session`
- `POST /api/auth/password-reset/confirm`
- OAuth auth routes remain under `/api/auth/oauth/*`

## Initial Setup

- `GET /api/setup/status`
- `POST /api/setup`
- `POST /api/setup/reset`

Frontend route:

- `GET /setup`

Notes:

- `POST /api/setup` is rate-limited and available only before initialization completes
- `POST /api/setup/reset` requires authenticated `ADMIN` plus password confirmation

## Public

- `GET /api/public/jobs`
- `GET /api/public/jobs/:slug`
- `GET /api/public/companies/:slug`

## Candidate

- profile, resume, saved-job, application, interview, offer, notification, export routes remain under `/api/candidate/*`
- new scheduling actions:
  - `POST /api/candidate/interviews/:roundId/reschedule-request`
  - `POST /api/candidate/interviews/reschedule-request/withdraw`
  - `GET /api/interviews/candidate/rounds/:roundId/calendar.ics`

## Recruiter Core

- jobs, requisitions, ATS, resume search, team, and dashboard routes remain under existing recruiter namespaces
- existing interview lifecycle routes remain under `/api/interviews/*`
- new meeting routes:
  - `GET /api/interviews/meetings`
  - `GET /api/interviews/assigned`
  - `POST /api/interviews/availability`
  - `GET /api/interviews/rounds/:roundId/meeting`
  - `POST /api/interviews/rounds/:roundId/reschedule-request`
  - `POST /api/interviews/reschedule-requests/:requestId/review`
  - `POST /api/interviews/reschedule-requests/withdraw`
  - `GET /api/interviews/rounds/:roundId/calendar.ics`

## Meeting Provider Administration

- `GET /api/meeting-providers/callback/:provider`
- `GET /api/meeting-providers/admin/providers`
- `POST /api/meeting-providers/admin/providers/:provider/connect`
- `POST /api/meeting-providers/admin/providers/:provider/validate`
- `DELETE /api/meeting-providers/admin/providers/:provider`

These routes are organization-admin scoped and never expose raw OAuth tokens.

## Enterprise Admin

- organization settings, roles, users, analytics, feature flags, audit, workflow, and notification admin routes remain under `/api/admin/*`
- interview scheduling policy is now persisted through organization settings updates

## Intelligence

Intelligence routes remain under `/api/intelligence/*` and are unchanged by Milestone 8.5.

## Health and Operations

- health endpoints remain unchanged
- reminder execution reuses background-task infrastructure

## Error Model Notes

The API returns normalized:

- validation errors
- permission errors
- organization-boundary errors
- conflict/stale-update errors
- safe provider errors

Raw Google or Zoom responses, tokens, host URLs, and stack traces are not returned to clients.
