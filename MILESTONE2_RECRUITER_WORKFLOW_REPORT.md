# Milestone 2 Recruiter Workflow Report

Date: Monday, July 20, 2026

## 1. Executive Summary

Milestone 2 is completed. The recruiter workflow now runs coherently from recruiter registration into workspace onboarding, secure team invitation, requisition-to-job continuity, job-context Resume Search, and ATS entry without replacing the existing ATS architecture or weakening organisation isolation.

## 2. Scope Completed

- Real recruiter workspace onboarding over existing organisation and recruiter profile data
- Token-based invitation flow with hashed tokens, expiry, revoke, resend, and single-use acceptance
- Members page backed by real member and invitation APIs
- Requisition-to-job continuity on recruiter pages
- Job-context Resume Search continuity
- Bulk recruiter action confirmations and partial-failure summaries
- Recruiter dashboard workflow continuation links and real invitation-aware metrics
- Recruiter notifications for invitation acceptance, requisition-linked job creation, and ATS insertion events

## 3. Files Changed

Core implementation files changed in this milestone:

- `shared/src/ats.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260720132151_milestone2_recruiter_workflow/migration.sql`
- `backend/src/serializers/index.js`
- `backend/src/services/organisationService.js`
- `backend/src/services/organisationInvitationService.js`
- `backend/src/services/jobService.js`
- `backend/src/services/atsService.js`
- `backend/src/services/emailService.js`
- `backend/src/controllers/organisationController.js`
- `backend/src/routes/organisationRoutes.js`
- `backend/src/__tests__/phase2-organisation.test.js`
- `frontend/lib/auth.js`
- `frontend/lib/api.js`
- `frontend/lib/roles.js`
- `frontend/app/recruiter/actions.js`
- `frontend/app/recruiter/onboarding/page.jsx`
- `frontend/app/recruiter/members/page.jsx`
- `frontend/app/recruiter/requisitions/page.jsx`
- `frontend/app/recruiter/jobs/page.jsx`
- `frontend/app/recruiter/page.jsx`
- `frontend/app/auth/invitations/actions.js`
- `frontend/app/auth/invitations/accept/page.jsx`
- `frontend/components/sections/recruiter-resume-search-workbench.jsx`
- `frontend/app/__tests__/recruiter-workflow-milestone2.test.jsx`
- `CAREERIZ_APPLICATION_AUDIT.md`
- `CAREERIZ_MODULE_STATUS.md`
- `CAREERIZ_MASTER_ROADMAP.md`
- `KNOWN_ISSUES.md`
- `MILESTONE2_QA_CHECKLIST.md`

## 4. Database Changes

- Added enum: `OrganisationInvitationStatus`
- Added model: `OrganisationInvitation`
- Added invitation relations on `User` and `Organisation`
- Reused existing `Organisation`, `OrganisationMembership`, `RecruiterProfile`, `JobRequisition`, `Job`, and `Application` models for onboarding and workflow continuity

## 5. Workspace Onboarding

- `/recruiter/onboarding` now reads real workspace data from the recruiter’s existing organisation and recruiter profile
- completion updates the existing organisation instead of creating a new one
- completion updates `RecruiterProfile.profileCompleted`
- repeat access redirects to `/recruiter` once onboarding is complete
- optional first teammate invitation can be sent from onboarding

## 6. Invitation Flow

- invitations are token-based
- raw tokens are generated with cryptographically secure random bytes
- only token hashes are stored
- invitations expire
- invitations can be resent and revoked
- acceptance is single-use
- duplicate active invitations for the same organisation/email are blocked
- acceptance requires matching signed-in recruiter email

## 7. Members Page

- active members now load from real organisation membership APIs
- pending invitations now load from real invitation APIs
- owner/admin users can invite, resend, and revoke
- lower-permission recruiters see access-limited messaging instead of management controls

## 8. Requisition-to-Job Continuity

- requisition page shows linked job state when a job already exists
- approved requisitions expose “Create Job from Requisition”
- job creation page accepts requisition-prefill query context
- duplicate active job creation for the same requisition is blocked in backend job creation logic
- job detail already preserves the requisition link through existing schema linkage

## 9. Resume Search Continuity

- Resume Search accepts active `jobId` and optional `requisitionId` context
- workbench shows requirement-linked messaging
- bulk actions now confirm before execution on multi-select
- partial failures now report counts plus safe failure summaries
- Elasticsearch fallback from Milestone 1 remains intact

## 10. ATS UX Improvements

- ATS insertion from Resume Search continues to reuse the existing `Application` pipeline
- duplicate ATS insertion remains blocked
- recruiter notifications are emitted on successful ATS insert/shortlist events where relevant
- ATS flow remains organisation-scoped and privacy-safe

## 11. Dashboard Changes

- recruiter dashboard now includes:
  - active jobs
  - draft jobs
  - candidates in ATS
  - pending team invitations
- added workflow continuation links for onboarding, requisitions, jobs, Resume Search, ATS, and team invites
- added explicit empty-state guidance for new workspaces

## 12. Security and Organization Isolation

- authentication remains unchanged
- invitation acceptance requires recruiter authentication and matching invite email
- organisation role checks remain enforced server-side
- cross-organisation invitation access is denied
- ATS/job/member flows continue to use existing organisation access services
- private candidate salary/contact visibility rules remain unchanged

## 13. Audit Logging

Added audit coverage for:

- `organisation.onboarding.complete`
- `organisation.invitation.create`
- `organisation.invitation.resend`
- `organisation.invitation.revoke`
- `organisation.invitation.accept`
- requisition-linked duplicate job prevention continues under existing job audit baseline

## 14. Tests Executed

Repository-level commands executed on July 20, 2026:

- `npm run lint` — passed
- `npm run type-check` — passed
- `npm test` — passed
- `npm run build` — passed
- `npx prisma validate` (backend workspace) — passed
- `npx prisma generate` (backend workspace) — passed

Milestone-specific added coverage:

- backend invitation flow tests in `backend/src/__tests__/phase2-organisation.test.js`
- frontend recruiter workflow page tests in `frontend/app/__tests__/recruiter-workflow-milestone2.test.jsx`

## 15. Build and Prisma Status

- frontend production build passed
- backend build placeholder command passed
- Prisma schema validated successfully
- Prisma client generated successfully
- migration generated successfully as `20260720132151_milestone2_recruiter_workflow`
- migration remains unapplied in the repository state, which is correct for source control

## 16. Manual QA

Manual browser QA was not performed in this session.

## 17. Known Remaining Issues

- Offer module is still missing
- Admin module is still placeholder-oriented
- Candidate onboarding remains lighter than recruiter workflow depth
- Resume Builder still behaves as a demo/local-save experience
- Footer encoding issue still remains
- Multi-organisation recruiter invitation acceptance needs broader manual QA

## 18. Recommendation for Milestone 3

Use Milestone 3 for:

- deeper ATS stage/history UX
- interview reschedule and calendar integration
- offer lifecycle implementation
- broader multi-organisation recruiter QA

## Command Results

- `npm run lint`: passed
- `npm run type-check`: passed
- `npm test`: passed
- `npm run build`: passed
- `npx prisma validate`: passed
- `npx prisma generate`: passed

## Final Status

Milestone 2 recruiter workflow completion is implementation-complete and build/test clean.
