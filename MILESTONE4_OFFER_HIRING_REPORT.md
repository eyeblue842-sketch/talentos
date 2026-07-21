# Milestone 4 Offer & Hiring Report

Date: Tuesday, July 21, 2026

## 1. Executive Summary

Milestone 4 completes the offer and hiring lifecycle on top of the existing ATS, interview, notification, and audit foundations. Careeriz Hire now supports recruiter offer drafting, sequential approval, secure release, candidate review and response, revision history, withdrawal, expiry resolution, and controlled joining outcomes without introducing a parallel ATS model.

## 2. Scope Completed

- coherent offer state machine
- Prisma offer domain models and migration
- recruiter draft, approval, release, revision, withdrawal, and joining actions
- secure candidate offer access by authenticated page and expiring token link
- offer PDF generation
- ATS/application activity and candidate timeline integration
- recruiter and candidate notifications for major offer events
- recruiter dashboard offer metrics

## 3. Files Changed

Backend:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260721044332_milestone4_offer_hiring_lifecycle/migration.sql`
- `backend/src/app.js`
- `backend/src/controllers/offerController.js`
- `backend/src/routes/offerRoutes.js`
- `backend/src/services/offerDocumentService.js`
- `backend/src/services/offerService.js`
- `backend/src/services/emailService.js`
- `backend/src/services/dashboardService.js`
- `backend/src/services/candidateService.js`
- `backend/src/serializers/index.js`
- `backend/src/__tests__/milestone4-offer-document.test.js`

Frontend:

- `frontend/lib/api.js`
- `frontend/app/recruiter/actions.js`
- `frontend/app/recruiter/ats/[applicationId]/page.jsx`
- `frontend/app/recruiter/page.jsx`
- `frontend/app/candidate/actions.js`
- `frontend/app/candidate/(workspace)/applications/[applicationId]/page.jsx`
- `frontend/app/candidate/(workspace)/offers/[offerId]/page.jsx`
- `frontend/app/offers/actions.js`
- `frontend/app/offers/access/[token]/page.jsx`
- `frontend/components/sections/recruiter-offer-workflow-panel.jsx`
- `frontend/components/sections/offer-experience-panel.jsx`
- `frontend/components/sections/candidate-application-detail-view.jsx`
- `frontend/components/sections/__tests__/offer-experience-panel.test.jsx`

Shared:

- `shared/src/ats.js`

Generated during validation:

- `frontend/tsconfig.tsbuildinfo`

## 4. Prisma Models and Migration

Added:

- `Offer`
- `OfferComponent`
- `OfferApproval`
- `OfferAccessToken`
- `OfferComment`

Migration created:

- `backend/prisma/migrations/20260721044332_milestone4_offer_hiring_lifecycle`

## 5. Offer Eligibility

Offer creation is enforced server-side:

- application must belong to the recruiter organisation
- candidate and job context must exist
- ATS application must already be in the interview-complete `SELECTED / Ready for offer` handoff state
- in-progress duplicate draft chains are blocked

## 6. Drafting and Compensation

- recruiter can create and edit offer drafts
- compensation fields support annual, fixed, variable, joining bonus, retention bonus, allowances, other compensation, and custom components
- totals are normalized server-side
- validation rejects negative or inconsistent values
- candidate-visible and internal-only fields remain separated

## 7. Approval Workflow

- approvals are sequential
- approvers must be active organisation members
- self-approval by the offer creator is blocked
- out-of-order approvals are rejected
- request changes returns the offer to `CHANGES_REQUESTED`
- release is blocked until every approval step is approved

## 8. Release and Candidate Access

- release finalizes one version
- secure access token is generated and only the token hash is stored
- candidate release email uses the current mail infrastructure
- candidate can access the offer either through:
  - authenticated workspace route `/candidate/offers/[offerId]`
  - expiring token route `/offers/access/[token]`

## 9. Candidate Response

Candidate can:

- view current offer
- download PDF
- accept
- reject
- request revision

Every response updates:

- offer status
- ATS activity
- candidate timeline
- recruiter notifications
- audit logs

## 10. Revision History

- revisions create new offer versions
- previous released offers remain intact until a new version is released
- on release, the prior released version becomes `SUPERSEDED`
- recruiter ATS detail shows version history

## 11. Withdrawal and Expiry

- recruiters can withdraw eligible offers with a reason
- offer expiry is resolved safely on access if `expiryAt` is in the past
- expired offers reject further candidate actions
- no background worker was introduced for scheduled expiry dispatch

## 12. Joining Lifecycle

Supported recruiter-managed states after acceptance:

- `JOINING_CONFIRMED`
- `DEFERRED`
- `JOINED`
- `NO_SHOW`

Rules enforced:

- joining updates require an accepted offer baseline
- `JOINED` requires an actual joining date
- `DEFERRED` and `NO_SHOW` require a reason

## 13. ATS Integration

- no new ATS pipeline enum was introduced
- offer states are mapped through the existing application model using `statusLabel`
- recruiter ATS application detail now includes embedded offer workflow controls
- candidate application detail now shows active offer summary and direct navigation

## 14. Notifications

Recruiter notifications:

- approval pending
- approved
- released
- viewed
- accepted
- rejected
- revision requested
- withdrawn
- joining status updates

Candidate notifications:

- offer released
- withdrawn
- joining status updates

## 15. Security and Organization Isolation

- recruiter offer routes require recruiter auth
- candidate offer routes require candidate ownership
- token routes require valid hashed tokens
- organisation scoping is enforced on every recruiter operation
- approval actions are scoped to the correct approver step
- raw tokens are not stored or logged
- internal notes and approval-only comments are not exposed to candidates

## 16. Audit Logging

Audited actions:

- offer create/update
- request approval
- approve/request changes/reject
- release
- revision create
- withdraw
- candidate accept/reject/request revision
- joining updates
- expiry resolution

## 17. Tests Executed

Repo-level:

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`

Prisma:

- `npx prisma validate`
- `npx prisma generate`

Added Milestone 4 tests:

- `backend/src/__tests__/milestone4-offer-document.test.js`
- `frontend/components/sections/__tests__/offer-experience-panel.test.jsx`

## 18. Build and Prisma Results

- lint: passed
- type-check: passed
- backend tests: passed, 86 tests
- frontend tests: passed, 62 tests
- repo build: passed
- `npx prisma validate`: passed
- `npx prisma generate`: passed

Operational note:

- test-schema migrate helpers against Supabase remained slow/time-out prone in this environment, so dashboard metrics include a narrow zero-fallback for not-yet-present offer/invitation tables during rollout.

## 19. Manual QA Status

Manual QA not performed in this implementation session.

## 20. Known Limitations

- background reminder automation for offers is not implemented
- organisation-level multi-template offer management is still a default-template baseline
- candidate onboarding remains shallower than the recruiter workflow
- admin module remains out of scope
- `Application` and `JobApplication` overlap still exists

## 21. Recommendation for Milestone 5

Milestone 5 should focus on admin and platform operations, plus broader release-hardening work:

- admin module completion
- operational tooling for offer/interview reminder automation
- deeper manual QA and cross-browser verification
- remaining candidate onboarding and public-site polish
