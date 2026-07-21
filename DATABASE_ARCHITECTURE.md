# Database Architecture

## Primary ORM

- Prisma ORM
- PostgreSQL primary target
- additive milestone migrations in `backend/prisma/migrations`

## Primary Tenant Boundary

Organization isolation is enforced through `organisationId` on operational models including jobs, applications, interview records, offers, audit logs, provider connections, and background tasks.

## Core Identity Models

- `User`
- `Organisation`
- `OrganisationMembership`
- `OrganisationSettings`
- `RecruiterProfile`
- `CandidateProfile`
- `AuthToken`

## Workflow Models

- jobs and requisitions: `Job`, `JobRequisition`
- ATS: `Application`, `JobApplication`, `ApplicationActivity`, `ApplicationTimeline`
- interviews: `InterviewProcess`, `InterviewRound`, `InterviewPanelMember`, `InterviewFeedback`
- offers: `Offer`, `OfferApproval`, `OfferRevision`, `OfferAccessToken`, `OfferComment`

## Milestone 8.5 Scheduling Models

- `MeetingProviderConnection`
  - encrypted OAuth tokens and connection metadata
  - unique per `organisationId + provider`
- `InterviewMeeting`
  - provider, mode, safe join URL, UTC schedule, provider state, optimistic operation fields
  - unique per `interviewRoundId`
- `MeetingParticipant`
  - candidate/interviewer/recruiter/coordinator membership for a meeting
- `InterviewRescheduleRequest`
  - actor-scoped reschedule requests with review state
- `InterviewRescheduleOption`
  - preferred slot proposals
- `InterviewScheduleHistory`
  - append-only schedule change history
- `MeetingReminder`
  - reminder rows linked to background task execution

`OrganisationSettings.interviewSchedulingSettings` stores validated scheduling policy such as allowed providers, reminder windows, reschedule rules, and defaults.

## Indexing Strategy

New schedule indexes focus on:

- provider connection status by organization
- upcoming meetings by organization and status
- provider lookups by external event/meeting id
- participant access by user/candidate
- pending reschedule requests
- reminder dispatch windows

## Migration Strategy

Milestone 8.5 adds:

- migration folder `20260721233000_milestone8_5_interview_scheduling`
- additive enums
- additive scheduling tables
- additive `OrganisationSettings.interviewSchedulingSettings`

`npx prisma validate` and `npx prisma generate` pass locally. Remote migration application was not performed.

## Ongoing Schema Risks

- `Application` and `JobApplication` overlap still increases long-term ATS complexity.
- Legacy tests still rely on some fixture paths that do not include all newer tables; backend services contain compatibility guards for those tests.
- Live migration deployment still requires staging/production database review before release.
