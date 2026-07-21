# Milestone 9 Setup Report

Updated: Tuesday, July 21, 2026

## Executive Summary

Milestone 9 adds a first-run setup wizard for fresh Careeriz installations. The implementation introduces setup detection, a transactional bootstrap flow, a guarded reset action, frontend route gating, and setup-state persistence without changing ATS, resume-builder integration, or business workflows.

## Scope Completed

- setup detection on startup and entry routes
- `/setup` frontend wizard
- backend setup status/create/reset routes
- transactional organization and admin bootstrap
- persisted setup state
- audit logging for completion and reset
- guarded reset flow
- shared validation schemas
- regression-safe compatibility fallback for legacy auth and ATS tests

## Files Changed

### Created

- `shared/src/setup.js`
- `backend/src/services/setupService.js`
- `backend/src/controllers/setupController.js`
- `backend/src/routes/setupRoutes.js`
- `backend/src/__tests__/milestone9-setup.test.js`
- `frontend/lib/setup.js`
- `frontend/app/setup/page.jsx`
- `frontend/components/setup/setup-wizard.jsx`
- `backend/prisma/migrations/20260722003000_milestone9_initial_setup_wizard/migration.sql`
- `INITIAL_SETUP_GUIDE.md`
- `DEPLOYMENT_BOOTSTRAP.md`
- `SETUP_WIZARD_ARCHITECTURE.md`
- `MILESTONE9_SETUP_REPORT.md`

### Modified

- `shared/src/index.js`
- `backend/prisma/schema.prisma`
- `backend/src/app.js`
- `backend/src/services/adminService.js`
- `backend/src/services/authService.js`
- `backend/src/services/atsService.js`
- `frontend/lib/api.js`
- `frontend/app/page.jsx`
- `frontend/app/auth/page.jsx`
- `frontend/app/auth/candidate/login/page.jsx`
- `frontend/app/auth/candidate/register/page.jsx`
- `frontend/app/hire/login/page.jsx`
- `frontend/app/hire/register/page.jsx`
- `frontend/app/candidate/page.jsx`
- `frontend/app/hire/page.jsx`
- `frontend/app/admin/actions.js`
- `frontend/app/admin/settings/page.jsx`
- `SYSTEM_ARCHITECTURE.md`
- `API_REFERENCE.md`
- `CAREERIZ_MASTER_ROADMAP.md`
- `CAREERIZ_MODULE_STATUS.md`
- `KNOWN_ISSUES.md`

## Prisma Models and Migration

Added:

- `PlatformSetupState`

Purpose:

- persist setup completion state
- persist setup version
- track setup completion actor/time
- track reset actor/time

Migration:

- `20260722003000_milestone9_initial_setup_wizard`

## Setup Detection

Detection logic checks:

- explicit `PlatformSetupState`
- organization count
- active admin count

Behavior:

- fresh installs redirect to `/setup`
- initialized installs skip setup and continue to login/auth flows

## Setup Creation Flow

`POST /api/setup` creates:

- organization
- initial admin user
- owner membership
- default role definitions
- default organization settings
- interview scheduling defaults
- notification defaults
- optional intelligence feature flags
- setup-state record

Creation runs in one transaction with rollback on failure.

## Security

- super-admin password is bcrypt-hashed
- duplicate email is rejected
- reset requires authenticated `ADMIN`
- reset requires password confirmation
- completion and reset create audit entries
- setup route creation and reset are rate-limited

## Reset Behavior

Reset is available from admin settings only.

It is intentionally blocked when the system already contains operational data such as jobs, applications, interviews, or offers.

## Compatibility Fixes Included

Milestone 9 introduced compatibility guards so older tests and legacy ATS scheduling paths continue to work when setup-state or interview-meeting infrastructure is unavailable in a test context.

## Tests Executed

- `npm run lint --prefix backend` ✅
- `npm run type-check --prefix backend` ✅
- `npm test --prefix backend` ✅
- `npm run build --prefix backend` ✅
- `npm run lint --prefix frontend` ✅
- `npm run type-check --prefix frontend` ✅
- `npm test --prefix frontend` ✅
- `npm run build --prefix frontend` ✅
- `npx prisma validate` from `backend` ✅
- `npx prisma generate` from `backend` ✅

## Manual QA Status

Not performed in this environment.

## Known Limitations

- the setup wizard currently supports an optional logo URL, not binary logo upload
- frontend type-check depends on `.next/types`; running `next build` regenerates them when absent
- setup reset is intentionally limited to pre-operational bootstrap recovery

## Recommendation

Proceed to manual installation QA on:

- a fresh database
- an initialized database
- admin reset path on a pre-operational install

Milestone 10 should remain focused on release QA, bug fixing, and staged deployment readiness rather than new product scope.
