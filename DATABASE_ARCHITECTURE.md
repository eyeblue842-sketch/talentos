# Database Architecture

## Primary ORM

- Prisma

## Primary Tenant Boundary

- `Organisation`

Most recruiter, ATS, interview, offer, admin, and intelligence records are organization-scoped through explicit foreign keys to `Organisation`.

## Core Identity Models

- `User`
- `RecruiterProfile`
- `CandidateProfile`
- `OrganisationMembership`

## Workflow Models

- `Job`
- `JobRequisition`
- `Application`
- `JobApplication`
- `ApplicationTimeline`
- `InterviewProcess`
- `InterviewRound`
- `InterviewPanelMember`
- `InterviewFeedback`
- `Offer`
- `OfferApproval`
- `OfferComment`

## Administration Models

- `OrganisationUnit`
- `OrganisationSettings`
- `OrganisationRoleDefinition`
- `NotificationTemplate`
- `FeatureFlag`
- `AuditLog`

## Intelligence and Hardening Models

Added in Milestone 7:

- `IntelligenceExecution`
- `IntelligenceResult`
- `IntelligenceFeedback`
- `BackgroundTask`

Milestone 8 extends the task model with:

- notification retry task support
- dead-letter task state

## Storage-Oriented Models

- `ResumeAsset`
- related resume snapshot/application attachment models

## Migration Strategy

- milestone-based additive migrations
- no destructive reset commands during milestone implementation
- indexes and foreign keys preserved per tenant boundary

## Ongoing Schema Risks

- `Application` and `JobApplication` overlap still adds maintenance complexity
- the worker runtime is now real, but long-term queue scaling still needs production traffic validation
