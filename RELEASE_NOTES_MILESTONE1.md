# Release Notes - Milestone 1

Date: 2026-07-20
Milestone: Foundation Stabilization

## Architecture Improvements

- Normalized recruiter workspace pages onto shared `WorkspaceShell`
- Standardized recruiter/admin navigation on `frontend/lib/navigation`
- Added live organization context usage across recruiter pages for consistent workspace framing
- Preserved existing auth, authorization, API contracts, and route behavior

## Repository Cleanup

- Removed remaining recruiter/admin `@/lib/mock-data` dependencies
- Deleted `frontend/lib/mock-data.js`
- Reduced duplicate navigation wiring in recruiter/admin surfaces
- Kept stabilization scope limited to consistency and technical debt removal

## Security Improvements

- Preserved existing JWT/session invalidation behavior
- Preserved organization isolation and ownership checks
- Kept recruiter Resume Search fallback user-safe without exposing internal backend errors
- Maintained route protection and role-based gating during workspace cleanup

## Workspace Consistency

- Recruiter pages now share:
  - common workspace shell
  - common navigation source
  - common breadcrumb/page-header structure
  - consistent organization branding context
- Admin page now uses shared admin navigation instead of `mock-data`

## Resume Search Improvements

- Removed hard failure when Elasticsearch is disabled
- Added automatic database fallback when Elasticsearch is disabled or unavailable
- Added recruiter-safe informational warning for fallback mode
- Preserved existing Resume Search privacy controls and ATS-aware context

## Testing

- `npm run lint` passed
- `npm run type-check` passed
- `npm test` passed
- `npm run build` passed
- `npx prisma validate` passed in backend
- `npx prisma generate` passed in backend

## Known Limitations

- Recruiter invitation flow is still missing
- Offer module is still missing
- Admin remains a placeholder module
- Candidate and recruiter onboarding pages still need full implementation
- Resume Builder still behaves as a demo experience
- Footer encoding issue is still present
