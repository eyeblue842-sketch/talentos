# Milestone 6 QA Checklist

Date: Tuesday, July 21, 2026

Use for manual verification of the enterprise administration milestone.

## Authentication and Access

- Admin workspace access with authenticated organization owner/admin
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Recruiter without enterprise permissions sees safe denial or restricted behavior
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Platform admin access, if configured, resolves a valid organization context
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Browser refresh preserves admin page access correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Deep links into admin subpages resolve correctly after login
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Organization Management

- Organization overview loads real organization data
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization profile update persists name, slug, and public fields safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization archive action succeeds with safe confirmation flow
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization restore action succeeds
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization units can be created for department, division, office location, and legal entity
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization unit update persists hierarchy and metadata
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Organization unit archive and restore behave correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## User Management

- Members list loads with pagination
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Search by user name or email works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Filter by membership role works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Filter by account status works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Last login and MFA status render without breaking layout
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Single membership role update persists correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Single account-status update persists correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Bulk invite succeeds for valid emails
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Duplicate active invitation handling returns a safe error
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Bulk role update succeeds for multiple users
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Bulk disable or suspend succeeds safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Ownership transfer protects the current organization boundary
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Final owner cannot be broken by unsafe role change
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Roles and Permissions

- System role definitions load
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Custom role creation persists name, slug, and permissions
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Base-role inheritance behaves as expected for a custom role
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Permission-denied states are safe for unauthorized users
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Settings and Workflow Administration

- Settings page loads current timezone, currency, language, and date format
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Settings update persists employment types, work modes, and experience bands
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Workflow page loads existing hiring and offer workflow config
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Workflow update persists templates and defaults safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Invalid settings payload returns safe validation feedback
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Audit Center

- Audit list loads with real entries
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Filter by user works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Filter by entity works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Filter by action works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Date filtering works
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Search query works without exposing unsafe internal data
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Notifications and Feature Flags

- Notification template list loads
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Notification template create or update succeeds
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Template enable and disable persists correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Feature flag list loads
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Feature flag create or update succeeds
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Feature flag enabled state persists correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Lookups and Background Jobs

- Lookup administration loads current skills, locations, departments, and countries
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Lookup update persists safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Background-jobs dashboard loads observability metrics without implying worker control
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Analytics

- Enterprise analytics loads real organization metrics
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Metrics match current jobs, applications, interviews, and offers data
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Empty-state organization shows safe zero-like analytics
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Security and Isolation

- Cross-organization admin access is denied safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Unauthorized membership mutation is denied safely
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Raw invitation tokens are not exposed in admin UI or errors
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Audit logs are created for admin-sensitive actions
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## General UX and Quality

- Responsive layout works across desktop, tablet, and mobile admin pages
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Browser back and forward navigation behaves correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- No hydration warnings appear
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- No console errors appear during normal admin flows
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
- Network failures return safe user-facing errors
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
