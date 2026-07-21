# Milestone 3 Interview Management Report

Date: Tuesday, July 21, 2026

## 1. Executive Summary

Milestone 3 is implemented on top of the existing ATS, authentication, organisation access, notification, and audit foundations. Careeriz Hire now supports a coherent interview lifecycle from ATS entry through interview planning, scheduling, panel assignment, feedback capture, candidate visibility, and hiring decision recording without introducing a parallel workflow system.

## 2. Scope Completed

- Multi-round interview plans per application using the existing `InterviewProcess` and `InterviewRound` models
- Rich interview round scheduling and rescheduling from ATS
- Panel assignment with lead, observer, and required-feedback flags
- Candidate-visible upcoming and past interview surfaces
- Structured interviewer feedback with lock-on-submit behaviour
- Hiring decision actions captured on interview rounds and reflected in ATS history
- ATS activity, candidate timeline, notification, and audit-log integration for interview events
- ICS calendar export through a provider abstraction baseline

## 3. Files Changed

- `shared/src/ats.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260721120000_milestone3_interview_management/migration.sql`
- `backend/src/controllers/interviewController.js`
- `backend/src/routes/interviewRoutes.js`
- `backend/src/serializers/index.js`
- `backend/src/services/interviewService.js`
- `backend/src/services/atsService.js`
- `backend/src/services/applicationWorkflowService.js`
- `backend/src/services/candidateService.js`
- `frontend/app/recruiter/actions.js`
- `frontend/app/recruiter/ats/[applicationId]/page.jsx`
- `frontend/app/candidate/(workspace)/dashboard/page.jsx`
- `frontend/components/sections/recruiter-application-detail-view.jsx`
- `frontend/components/sections/candidate-application-detail-view.jsx`
- `CAREERIZ_APPLICATION_AUDIT.md`
- `CAREERIZ_MODULE_STATUS.md`
- `CAREERIZ_MASTER_ROADMAP.md`
- `KNOWN_ISSUES.md`
- `MILESTONE3_QA_CHECKLIST.md`

## 4. Database Changes

- Extended enum `InterviewType` with:
  - `MANAGER`
  - `DIRECTOR`
  - `CLIENT`
  - `BEHAVIORAL`
  - `CUSTOM`
- Added enum `MeetingMode`
- Added enum `InterviewDecision`
- Extended `InterviewRound` with owner, duration, timezone, meeting mode, office/candidate instructions, internal notes, decision metadata, completion metadata, calendar provider, and reschedule counters
- Extended `InterviewPanelMember` with `isLead`, `isObserver`, and `feedbackRequired`
- Extended `InterviewFeedback` with structured interview scoring and detailed written feedback fields

## 5. Workspace Onboarding

- No recruiter onboarding behaviour was weakened or replaced in this milestone
- Milestone 2 onboarding remains intact and is reused as the entry point into the recruiter interview workflow

## 6. Invitation Flow

- No invitation security logic changed in this milestone
- Milestone 2 hashed, expiring, single-use invitation flow remains intact

## 7. Members Page

- No member-management permissions were weakened
- Panel assignment now reuses organisation membership and role checks so only valid organisation users can participate in interviews

## 8. Requisition-to-Job Continuity

- Existing Milestone 2 requisition-to-job continuity remains intact
- Interview work starts from ATS/application context after the requisition and job workflow has already completed

## 9. Resume Search Continuity

- Resume Search integration remains tied to ATS insertion for the correct job
- Candidates added from Resume Search can now flow into multi-round interview management after ATS entry
- Elasticsearch fallback from Milestone 1 remains unchanged

## 10. ATS UX Improvements

- Recruiter ATS application detail now includes:
  - interview plan creation
  - additional round creation
  - round repeat/duplicate
  - richer scheduling fields
  - panel visibility
  - structured feedback entry
  - hiring decision controls
  - clearer interview state summaries
- Existing ATS notes, stage movement, activity history, and screening data remain preserved

## 11. Dashboard Changes

- Candidate dashboard now includes an upcoming interviews card fed by real backend interview data
- Recruiter dashboard already used real upcoming interview data and continues to do so

## 12. Security and Organization Isolation

- Organisation isolation remains enforced on interview plan, round, panel, feedback, and decision actions
- Cross-organisation panel assignment is rejected
- Only organisation members with interview-eligible roles can be assigned to panels
- Feedback visibility and submission remain organisation-scoped
- Candidate-visible interview data excludes recruiter-only notes and organisation-internal commentary

## 13. Audit Logging

Added or expanded audit coverage for:

- `interview.plan.create`
- `interview.round.create`
- `interview.round.update`
- `interview.round.duplicate`
- `interview.round.decision`
- `interview.feedback.save`
- `interview.feedback.finalize`
- existing ATS schedule/cancel interview audit entries remain active

## 14. Tests Executed

Commands executed on Tuesday, July 21, 2026:

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`

Validation status:

- backend tests: `84 passed`
- frontend tests: `61 passed`
- frontend jsdom canvas warnings still appear during tests but do not fail the suite

## 15. Build and Prisma Status

- `npm run lint` passed
- `npm run type-check` passed
- `npm test` passed
- `npm run build` passed
- `npx prisma validate` passed
- `npx prisma generate` passed after a retry following a transient Windows Prisma DLL rename lock

## 16. Manual QA

Manual browser QA was not performed in this session.

## 17. Known Remaining Issues

- Offer module is still missing
- Admin module is still placeholder-oriented
- Interview reminders are emitted safely when a round is scheduled inside the 24-hour or 1-hour window, but there is still no background reminder worker for future scheduled dispatch
- Candidate onboarding still remains lighter than recruiter workflow depth
- Resume Builder still behaves as a demo/local-save experience
- Footer encoding issue still remains

## 18. Recommendation for Milestone 4

Milestone 4 should focus on:

- offer management
- candidate onboarding completion
- deeper candidate-side workflow continuity after interviews
- remaining ATS/application model cleanup
- broader manual QA across recruiter and candidate interview flows

## Command Results

- `npm run lint`: passed
- `npm run type-check`: passed
- `npm test`: passed
- `npm run build`: passed
- `npx prisma validate`: passed
- `npx prisma generate`: passed

## Final Status

Milestone 3 interview management is implementation-complete and validation-clean.
