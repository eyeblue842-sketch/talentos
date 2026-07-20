# Milestone 1 QA Checklist

Date: 2026-07-20
Scope: Documentation-only manual QA checklist for Foundation Stabilization closeout

## Authentication

### Candidate Login

- Open candidate login page `/auth/candidate/login`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Log in with a verified candidate account
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm redirect lands in candidate workspace
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm browser refresh preserves authenticated candidate session
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

### Recruiter Login

- Open recruiter login page `/hire/login`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Log in with a verified recruiter account
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm redirect lands in recruiter workspace
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm browser refresh preserves authenticated recruiter session
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Workspace

- Open `/recruiter` and confirm page loads with shared recruiter navigation
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm recruiter navigation items are consistent across recruiter pages
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm breadcrumbs render consistently on recruiter pages
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm organization branding/slug context appears consistently where expected
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Jobs

- Open `/recruiter/jobs`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm jobs list renders without navigation/layout regressions
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm empty state appears correctly when no jobs are available
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Open a job detail deep link `/recruiter/jobs/[jobId]`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Requisitions

- Open `/recruiter/requisitions`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm requisition page uses shared recruiter shell/navigation
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm empty and error states are readable
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Resume Search

- Open `/recruiter/database`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm filters render in the left panel and results in the main panel
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm candidate preview opens correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm saved searches and recent searches render without layout regressions
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- With Elasticsearch enabled, confirm Resume Search still works normally
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- With Elasticsearch disabled or unavailable, confirm Resume Search falls back and shows only an informational warning
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm no internal error details are shown to recruiters during fallback
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## ATS

- Open `/recruiter/ats`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm stage columns render correctly
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Open an application deep link `/recruiter/ats/[applicationId]`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm application detail page keeps shared workspace layout
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Notifications

- Open `/recruiter/notifications`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm notifications list renders with consistent navigation and breadcrumb structure
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm empty state is readable when there are no notifications
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Settings

- Open `/recruiter/settings`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm organization context loads without shell/layout regressions
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Members

- Open `/recruiter/members`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm members list renders with shared recruiter workspace layout
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm empty state is readable if no members exist
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Admin Access

- Open `/admin` with an admin-authorized account
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm admin route protection blocks non-admin access
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm admin page uses shared admin navigation instead of `mock-data`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Browser Refresh

- Refresh recruiter workspace pages and confirm session continuity
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Refresh candidate workspace pages and confirm session continuity
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Deep Links

- Open recruiter deep links directly:
  - `/recruiter/jobs/[jobId]`
  - `/recruiter/ats/[applicationId]`
  - `/recruiter/database/[candidateId]`
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm protected deep links redirect correctly when not authenticated
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Error Handling

- Force a backend error on recruiter pages and confirm only safe user-facing errors appear
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm Resume Search fallback does not expose internal Elasticsearch errors
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Empty States

- Verify empty state behavior for:
  - recruiter jobs
  - requisitions
  - notifications
  - members
  - resume search results
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Responsive Layout

- Verify recruiter workspace pages on narrow/mobile viewport
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm no horizontal overflow in recruiter workspace shell
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

- Confirm public auth pages remain usable on mobile
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Console Errors

- Confirm no new browser console errors on:
  - recruiter dashboard
  - jobs
  - requisitions
  - resume search
  - ATS
  - notifications
  - settings
  - members
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Network Errors

- Confirm failed network requests surface safe UI feedback and do not break the shell
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:

## Hydration Warnings

- Confirm no hydration warnings on recruiter workspace pages
  - Status: `□ Pass` `□ Fail` `□ N/A`
  - Notes:
