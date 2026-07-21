# Interview Scheduling and Rescheduling

## Scheduling Flow

1. Validate input, timezone, provider, permissions, and organization scope.
2. Resolve or verify provider connection if needed.
3. Create/update local meeting state.
4. Create or update provider meeting/event.
5. Persist provider metadata and participants.
6. Generate calendar file data.
7. Schedule reminders through background tasks.
8. Create notifications and audit history.

## Reschedule Paths Implemented

- recruiter direct reschedule
- candidate reschedule request
- interviewer reschedule request
- request withdrawal
- request review and approval/rejection
- participant replacement without candidate-facing reschedule messaging when time does not change
- reminder cancellation and recreation after schedule changes

## Safety Rules

- provider failure must not silently move the meeting to a successful new schedule
- old schedule remains valid if provider update fails before confirmation
- reschedule history is append-only
- conflicting updates are guarded by versioned provider operation flow and service-side conflict handling

## Current Limitations

- live provider and availability verification still require staging QA with real credentials
- interviewer-specific standalone UI remains lighter than recruiter/candidate surfaces
