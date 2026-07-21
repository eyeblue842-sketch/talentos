# Initial Setup Guide

Updated: Tuesday, July 21, 2026

## Purpose

Careeriz now includes a first-run setup wizard for fresh installations. The wizard is a deployment bootstrap utility, not a recruitment feature.

It creates:

- the first organization
- the first super administrator account
- baseline organization settings
- scheduling defaults
- notification defaults
- optional intelligence feature flags
- an audit entry marking setup completion

## When the Wizard Appears

The backend evaluates initialization state through `/api/setup/status`.

Careeriz is considered initialized when either:

- `PlatformSetupState.setupCompleted` is `true`, or
- legacy compatibility signals show at least one organization and one active admin user

If the system is not initialized:

- public entry routes redirect to `/setup`
- registration is blocked server-side

If the system is initialized:

- `/setup` redirects away to login flow

## Wizard Steps

### Step 1: Organization

- Company Name
- Company Logo URL, optional
- Industry
- Country
- Timezone
- Currency
- Date Format

### Step 2: Super Administrator

- Name
- Email
- Mobile
- Password
- Confirm Password

Password policy:

- minimum 12 characters
- uppercase required
- lowercase required
- number required
- special character required

### Step 3: System Preferences

- Language
- Default Meeting Provider
- Google enabled
- Zoom enabled
- Email Provider
- AI enabled
- Notification Preferences

### Step 4: Confirmation

The wizard creates the initial records in one transaction and then redirects to `/auth?setup=complete`.

## Reset Behavior

Setup does not reopen automatically after completion.

Reset is available only to an authenticated backend `ADMIN` user from admin settings and requires password confirmation.

The reset is intentionally restricted:

- only before operational data exists
- only when the installation still contains the single initial organization/admin footprint

This prevents destructive resets after real recruiting data exists.

## Operational Notes

- Passwords are hashed with bcrypt using 12 rounds.
- Setup completion writes an audit event: `platform.initial-setup.complete`.
- Reset writes an audit event: `platform.initial-setup.reset`.
- Setup state is stored in `PlatformSetupState`.
- Company logo upload is not part of the setup wizard; the current wizard accepts an optional logo URL.

## Validation Commands

- `npm run lint --prefix backend`
- `npm run type-check --prefix backend`
- `npm test --prefix backend`
- `npm run build --prefix backend`
- `npm run lint --prefix frontend`
- `npm run type-check --prefix frontend`
- `npm test --prefix frontend`
- `npm run build --prefix frontend`
- `npx prisma validate` from `backend`
- `npx prisma generate` from `backend`
