# Deployment Bootstrap

Updated: Tuesday, July 21, 2026

## Goal

Milestone 9 adds a bootstrap path for first-time deployment so a new Careeriz installation can be safely initialized without manual database seeding.

## Bootstrap Sequence

1. Start backend, frontend, database, Redis, and supporting services.
2. Open Careeriz entry URL.
3. Frontend checks setup state through `GET /api/setup/status`.
4. If the installation is fresh, the user is redirected to `/setup`.
5. Complete the four-step setup wizard.
6. Backend creates the initial organization, admin user, role definitions, settings, and setup state in one transaction.
7. The installation is marked complete and future sessions go to login instead of setup.

## Fresh Install Requirement

The setup wizard is shown only when the platform has not been initialized.

Current detection uses:

- `PlatformSetupState.setupCompleted`
- organization count
- active admin count

## Required Runtime Dependencies

Bootstrap depends on the existing validated Milestone 8 environment:

- PostgreSQL
- Prisma migrations
- backend API
- frontend app
- shared env validation

No Elasticsearch, meeting-provider OAuth, or intelligence provider setup is required to complete the initial wizard.

## Post-Bootstrap Outcome

After setup completes:

- setup is locked
- public/auth routes stop redirecting to `/setup`
- new registration routes work again
- admin settings exposes the guarded reset action

## Failure Handling

Setup creation is transactional.

If any creation step fails:

- the transaction rolls back
- no partial organization/admin state is left behind
- the wizard remains available

## Recommended Deployment Order

1. Apply migrations.
2. Validate Prisma client generation.
3. Start backend.
4. Start frontend.
5. Complete `/setup`.
6. Log in as the first super administrator.
7. Continue with organization configuration and provider setup.

## Reset Safety

`POST /api/setup/reset` is intentionally limited.

It is not a general-purpose wipe endpoint. It is only for early installation recovery before live data exists.
