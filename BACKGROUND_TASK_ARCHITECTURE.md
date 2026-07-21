# Background Task Architecture

## Scope

Careeriz uses a persisted `BackgroundTask` model plus worker runtime for retry-safe asynchronous operations.

## Current Task Model

Each task records:

- type
- status
- idempotency key
- retry metadata
- payload
- organisation scope where relevant
- creator/updater attribution

## Active Task Types

- interview reminders
- offer expiry
- offer reminders
- email retry
- notification retry
- resume parsing
- intelligence execution
- data export
- stale-result cleanup

## Milestone 8.5 Additions

Interview scheduling now creates and manages reminder work through `MeetingReminder` rows plus background tasks:

- schedule reminders after successful meeting creation/reschedule
- cancel obsolete tasks after reschedule or cancellation
- prevent duplicate reminder creation through participant/reminder uniqueness
- keep operational history even after cancellation

The scheduler path was updated to read `MeetingReminder` instead of directly scanning `InterviewRound`.

## Worker Safety Rules

- no synchronous reminder sending inside request handlers
- retries and dead-letter behavior remain active
- reminder operations must be idempotent
- reschedule/cancellation must cancel obsolete future reminder tasks

## Future Expansion

The same task system can later handle:

- provider retry operations
- meeting sync reconciliation
- stale provider connection health checks

No new queue vendor was introduced in Milestone 8.5.
