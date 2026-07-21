# Milestone 5 Candidate Experience Report

## 1. Executive Summary

Milestone 5 completes the candidate-facing product baseline without introducing a native Resume Builder. Candidates now have a real onboarding flow, dashboard, profile management, secure resume asset management, job discovery continuity, saved jobs, application tracking, interview center, offer center, notification preferences, privacy controls, account deactivation request flow, and data export foundation. Resume authoring is intentionally externalized behind a centralized Resume Builder integration boundary.

## 2. Scope Completed

- candidate onboarding
- candidate dashboard
- profile management depth
- resume asset management
- external Resume Builder integration boundary
- job discovery continuity and additional public sort support
- saved jobs continuity
- application resume selection and safer candidate status labeling
- interview center
- offer center
- candidate notifications and preferences
- account settings, deactivation request, and data export foundation

## 3. Files Changed

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260721183000_milestone5_candidate_experience_resume_builder_integration/migration.sql`
- `backend/src/config/env.js`
- `backend/src/controllers/applicationWorkflowController.js`
- `backend/src/controllers/candidateController.js`
- `backend/src/controllers/resumeBuilderController.js`
- `backend/src/controllers/resumeController.js`
- `backend/src/routes/applicationWorkflowRoutes.js`
- `backend/src/routes/candidateRoutes.js`
- `backend/src/services/applicationWorkflowService.js`
- `backend/src/services/candidateService.js`
- `backend/src/services/dashboardService.js`
- `backend/src/services/publicPortalService.js`
- `backend/src/services/resumeBuilderService.js`
- `shared/src/phase4.js`
- `frontend/lib/api.js`
- `frontend/lib/navigation.js`
- `frontend/components/layout/sidebar.jsx`
- `frontend/components/sections/candidate-profile-form.jsx`
- `frontend/components/sections/candidate-settings-form.jsx`
- `frontend/components/sections/candidate-resume-center.jsx`
- `frontend/components/sections/public-job-search-form.jsx`
- `frontend/components/sections/__tests__/candidate-experience-a11y.test.jsx`
- `frontend/app/candidate/actions.js`
- `frontend/app/candidate/(workspace)/dashboard/page.jsx`
- `frontend/app/candidate/(workspace)/applications/page.jsx`
- `frontend/app/candidate/(workspace)/onboarding/page.jsx`
- `frontend/app/candidate/(workspace)/resume-builder/page.jsx`
- `frontend/app/candidate/(workspace)/resumes/page.jsx`
- `frontend/app/candidate/(workspace)/interviews/page.jsx`
- `frontend/app/candidate/(workspace)/offers/page.jsx`
- `frontend/app/candidate/(workspace)/tools/page.jsx`
- `frontend/app/jobs/[slug]/apply/page.jsx`
- `frontend/app/resume-builder/page.jsx`
- `frontend/app/api/candidate/export/route.js`
- `frontend/vitest.config.mjs`
- updated status documentation files

## 4. Prisma Models and Migration

Schema additions focused on candidate continuity:

- `CandidateProfile` onboarding, privacy, notification preference, structured profile, and account lifecycle fields
- `ResumeAsset` lifecycle, source, parsing, primary-resume, archive, and external-builder metadata fields
- new enums for candidate employment status, resume asset lifecycle/source/parsing, and account lifecycle

Migration created:

- `20260721183000_milestone5_candidate_experience_resume_builder_integration`

Operational note:

- `prisma migrate dev --create-only` could not reach the remote Supabase host during this session, so the migration SQL was created manually after schema validation.

## 5. Candidate Onboarding

- Added persisted onboarding state at `/candidate/onboarding`
- Prepopulates from existing profile data
- Supports save-and-resume behavior
- Supports optional skip on the resume step
- Uses real completion state derived from persisted data
- Writes candidate activity and audit entries on save/completion

## 6. Candidate Dashboard

- Dashboard now uses persisted data only
- Added onboarding state, resume status, active offers, recent jobs, notifications, recent applications, and quick actions
- Empty-state-safe rendering was added for resume status and other candidate sections

Profile completion formula:

- `Basic details` 20%
- `Professional details` 15%
- `Resume availability` 20%
- `Skills and expertise` 15%
- `Preferences` 15%
- `Professional summary and links` 15%

## 7. Profile Management

- Expanded candidate profile update handling for:
  - phone
  - current employer/designation
  - employment status
  - last working date
  - privacy flags
  - structured JSON-backed skills, experience, education, certifications, languages, projects, and portfolio links
- Ownership remains candidate-scoped
- Validation stays in shared schemas

## 8. Resume Management

- Added resume center at `/candidate/resumes`
- Supports upload, download, set primary, archive, restore, delete, retry parse, and parsed-field application
- Restricts apply-time resume selection to active resumes
- Protects against deleting resumes already referenced by application snapshots
- Uses deterministic metadata fallback parsing when richer parsing is unavailable

## 9. Resume Builder Integration

- Replaced the unfinished native-builder flow with centralized external integration
- Added environment-driven provider config
- Added safe deep-link generation for create/edit/manage actions
- Added external resume metadata persistence onto `ResumeAsset`
- Updated `/candidate/resume-builder` and `/resume-builder` to reflect product separation

## 10. Job Discovery

- Preserved public job discovery
- Added `closing_date` sort support to public portal service and search form
- Candidate workspace navigation now routes users toward jobs, saved jobs, applications, interviews, offers, resumes, profile, notifications, and settings

## 11. Saved Jobs

- Existing persisted saved jobs flow remains in place
- Candidate dashboard and navigation now surface saved jobs more consistently
- Ownership and duplicate-save protections remain intact

## 12. Applications

- Candidate apply flow now filters resume choices to active resume assets only
- Candidate-visible application status mapping now includes offer and joining-stage labels
- Applications page exposes the `OFFER` filter
- Candidate withdrawal and duplicate protections remain unchanged

## 13. Interview Center

- Added `/candidate/interviews`
- Uses Milestone 3 interview data
- Separates upcoming, past, cancelled, and rescheduled views
- Exposes only candidate-safe fields

## 14. Offer Center

- Added `/candidate/offers`
- Uses Milestone 4 offer data
- Separates active, accepted, rejected, expired, withdrawn, and superseded offers
- Uses existing secure offer lifecycle and candidate-visible permissions

## 15. Notifications

- Candidate settings now support persisted notification preferences for email and in-app channels
- Existing notification center remains recipient-scoped
- Deep-link safety remains intact

## 16. Account Settings

- Added privacy/searchability controls to settings
- Added candidate data export endpoint and action
- Added candidate account deactivation request workflow
- Password change stays routed through the existing auth architecture

## 17. Privacy and Candidate Isolation

- Candidate profile, resume, application, interview, and offer access remains ownership-scoped
- Recruiter visibility stays controlled by existing application and resume-search permissions
- Resume Builder URLs are validated against configured origin
- Internal recruiter comments/approval notes are not exposed to candidate surfaces

## 18. Data Export

- Added synchronous candidate JSON export foundation via `/api/candidate/export`
- Export includes candidate-owned profile, preferences, resume metadata, saved jobs, applications, interviews, offers, and notifications
- Internal recruiter-only data is excluded

## 19. Tests Executed

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`
- `npx prisma validate` (backend workspace)
- `npx prisma generate` (backend workspace)

## 20. Build and Prisma Results

- `npm run lint` passed
- `npm run type-check` passed
- `npm test` passed
- `npm run build` passed
- `npx prisma validate` passed
- `npx prisma generate` passed

Additional note:

- frontend test execution was stabilized by setting Vitest to `pool: 'threads'` in config because forked workers were timing out in this environment

## 21. Manual QA Status

Manual QA not performed in this session.

## 22. Known Limitations

- Resume Builder integration is deep-link only for now
- No native Resume Builder exists in Careeriz by design
- Parsed resume suggestions are intentionally basic when advanced parsing is unavailable
- Public candidate profile remains deferred
- Account deletion is a deactivation request, not destructive deletion
- Reminder automation remains pending for future scheduled interview/offer notifications

## 23. Recommendation for Milestone 6

Build Enterprise Administration next, then follow with release-hardening work for reminder automation, footer cleanup, and broader manual regression coverage.
