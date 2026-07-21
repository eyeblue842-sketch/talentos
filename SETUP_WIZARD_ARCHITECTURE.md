# Setup Wizard Architecture

Updated: Tuesday, July 21, 2026

## Overview

The initial setup wizard is a bootstrap subsystem that sits outside normal candidate, recruiter, ATS, and interview workflows.

It reuses existing organization, membership, settings, feature-flag, audit, and auth primitives rather than creating a separate provisioning stack.

## Detection Model

Backend service: `backend/src/services/setupService.js`

Primary state:

- `PlatformSetupState.id = "platform-setup"`
- `setupCompleted`
- `setupVersion`
- `setupCompletedAt`
- `setupCompletedBy`
- `lastResetAt`
- `lastResetBy`

Compatibility fallback:

- if legacy data contains at least one organization and one active admin, setup is treated as initialized

## Data Model

New Prisma model:

- `PlatformSetupState`

Relations:

- `completedByUser`
- `resetByUser`

Milestone 9 migration:

- `20260722003000_milestone9_initial_setup_wizard`

## Backend Flow

### Status

`GET /api/setup/status`

Returns whether setup is complete and whether setup mode should be forced.

### Completion

`POST /api/setup`

Validation:

- shared Zod schema from `shared/src/setup.js`
- password policy
- duplicate email prevention
- rate limiting

Execution:

1. ensure setup is not already complete
2. normalize super-admin email
3. hash password with bcrypt
4. create organization
5. create admin user
6. create owner membership
7. seed role definitions
8. seed organization settings
9. apply setup preferences
10. optionally seed intelligence feature flags
11. persist `PlatformSetupState`
12. write audit log

All creation steps occur inside a single Prisma transaction.

### Reset

`POST /api/setup/reset`

Guards:

- authenticated `ADMIN` only
- password confirmation required
- rate limited
- blocked if operational data exists

Execution:

1. verify actor role
2. verify password
3. confirm safe-reset conditions
4. write reset audit entry
5. mark setup incomplete
6. remove bootstrap organization
7. remove bootstrap admin user

## Frontend Flow

Frontend files:

- `frontend/app/setup/page.jsx`
- `frontend/components/setup/setup-wizard.jsx`
- `frontend/lib/setup.js`

Behavior:

- `/setup` is server-rendered
- public and auth entry pages call `redirectToSetupIfRequired()`
- initialized systems call `redirectAwayFromSetupIfInitialized()`

Wizard UX:

- 4 steps
- progress indicator
- client-side step validation
- final API submit to `/api/setup`

## Security Controls

- password hashing: bcrypt, 12 rounds
- no plaintext password storage
- setup reset requires current password
- setup routes use validation + rate limiting
- setup completion and reset are auditable
- setup is disabled after successful completion

## Reused Platform Services

- `ensureSystemRoleDefinitions`
- `ensureOrganisationSettings`
- `recordAuditLog`
- shared schema validation
- existing auth middleware
- existing admin settings surface for reset control

## Known Design Boundaries

- the current wizard accepts an optional logo URL rather than uploading a file
- the first super administrator is stored using the existing backend `ADMIN` role
- reset is intentionally narrow and not intended for live production environments with operational data
