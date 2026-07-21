# Background Task Architecture

## Scope

Milestone 7 does not introduce a full worker platform. It introduces a bounded task architecture so future automation can be added without rewriting interview, offer, intelligence, or export services.

## Current Task Model

Prisma model: `BackgroundTask`

Core fields:

- `type`
- `status`
- `entityType`
- `entityId`
- `idempotencyKey`
- `payload`
- `attemptCount`
- `maxAttempts`
- `lastErrorCode`
- `lastErrorMessage`
- `lastAttemptAt`
- `nextAttemptAt`
- `createdByUserId`
- `updatedByUserId`
- `completedAt`

## Task Types

- `INTERVIEW_REMINDER`
- `OFFER_EXPIRY`
- `OFFER_REMINDER`
- `EMAIL_RETRY`
- `RESUME_PARSE`
- `INTELLIGENCE_EXECUTION`
- `DATA_EXPORT`
- `STALE_RESULT_CLEANUP`

## Task Statuses

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`
- `RETRYING`

## Design Intent

The task model provides:

- idempotency-key protection
- safe admin visibility
- future retry metadata
- entity linkage
- organization attribution where relevant

## Current Milestone 7 Behavior

- interview reminders are not backed by a general scheduler yet
- offer expiry still relies on safe service checks and on-access resolution
- intelligence execution remains synchronous in the current request path
- the admin background-jobs page remains informational and does not claim worker execution that does not exist

## Future Worker Integration

Recommended future additions:

- lightweight polling worker or queue consumer
- Redis-backed dispatch or equivalent queue later
- retry scheduling by `nextAttemptAt`
- alerting on repeated failure
- worker health partitioned by task type

## Safety Rules

- no task should execute cross-organization actions without a fresh scope check
- sensitive tokens must never be stored in task payloads
- retries must remain idempotent
- synchronous fallbacks must not claim that scheduled dispatch already exists
