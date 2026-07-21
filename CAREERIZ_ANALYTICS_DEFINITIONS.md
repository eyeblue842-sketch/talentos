# Careeriz Analytics Definitions

All metrics in Milestone 7 use deterministic backend services from `backend/src/intelligence/services/analyticsMetricsService.js`. Organization scope and timezone consistency are applied before aggregation.

## Active Jobs

- Formula: count of jobs where status is active/open in the selected organization and filter scope
- Source fields: `Job.status`, `Job.organisationId`, optional recruiter and created-date filters
- Event date used: current-state metric, not a point-in-time event
- Filters: organization, recruiter, created-range where supplied
- Timezone: organization timezone for derived period labels only
- Exclusions: draft, archived, or closed jobs
- Null handling: returns `0`
- Sample-size limitation: none

## Draft Jobs

- Formula: count of jobs in draft state
- Source fields: `Job.status`
- Event date used: current state
- Filters: organization and supplied scope filters
- Timezone: organization timezone for presentation
- Exclusions: non-draft jobs
- Null handling: returns `0`
- Sample-size limitation: none

## Application Volume

- Formula: total applications in scope
- Source fields: `Application.createdAt`, `Application.organisationId`
- Event date used: application creation timestamp
- Filters: organization, date range, recruiter scope where supported
- Timezone: organization timezone when applying date boundaries
- Exclusions: none unless explicitly filtered out
- Null handling: returns `0`
- Sample-size limitation: low counts can make trend interpretation unreliable

## Interview Volume

- Formula: total interviews/round instances in scope
- Source fields: `InterviewRound.scheduledStartAt` or equivalent scheduled timestamp
- Event date used: interview scheduled date
- Filters: organization, date range, recruiter/job scope where supported
- Timezone: organization timezone
- Exclusions: records outside filter period
- Null handling: returns `0`
- Sample-size limitation: small samples should not drive causal claims

## Offer Volume

- Formula: total offers created or released in scope, depending on the specific view
- Source fields: `Offer.createdAt`, `Offer.releasedAt`, `Offer.status`
- Event date used: current implementation uses offer creation for baseline volume and explicit release timestamps for release-state views
- Filters: organization, date range, job/recruiter scope where supported
- Timezone: organization timezone
- Exclusions: none unless filtered by status
- Null handling: returns `0`
- Sample-size limitation: low offer counts distort acceptance rates

## Offer Acceptance Rate

- Formula: accepted offers / released offers
- Source fields: `Offer.status`, `Offer.releasedAt`, `Offer.acceptedAt`
- Event date used: release date for denominator, accepted state for numerator within scope
- Filters: organization and selected date range
- Timezone: organization timezone
- Exclusions: draft, pending approval, withdrawn before release
- Null handling: returns `null` when denominator is zero
- Sample-size limitation: unstable for low denominators

## Interview-to-Offer Conversion

- Formula: released offers / interview-completed applications in scope
- Source fields: interview completion timestamps, offer release timestamps
- Event date used: interview completion for denominator, offer release for numerator
- Filters: organization and selected date range
- Timezone: organization timezone
- Exclusions: incomplete interviews and unreleased offers
- Null handling: returns `null` when denominator is zero
- Sample-size limitation: directional only for low sample sizes

## Application-to-Interview Conversion

- Formula: applications that reached interview scheduled/completed state / total applications
- Source fields: application lifecycle, interview linkage
- Event date used: application created date for denominator; first interview event for numerator qualification
- Filters: organization and selected date range
- Timezone: organization timezone
- Exclusions: withdrawn or rejected applications still count in denominator if created in scope
- Null handling: returns `null` when denominator is zero
- Sample-size limitation: sensitive to pipeline timing lag

## Joining Ratio

- Formula: joined offers or applications / accepted offers
- Source fields: `Offer.status`, joining timestamps, application joined state
- Event date used: acceptance date for denominator, actual joined date for numerator
- Filters: organization and selected date range
- Timezone: organization timezone
- Exclusions: non-accepted offers
- Null handling: returns `null` when denominator is zero
- Sample-size limitation: long joining lead time can delay signal completeness

## Time to Offer

- Formula: median days from application creation to offer release
- Source fields: `Application.createdAt`, `Offer.releasedAt`
- Event date used: applied date to offer release date
- Filters: organization, date range
- Timezone: organization timezone
- Exclusions: applications without a released offer
- Null handling: returns `null` when no qualifying records exist
- Sample-size limitation: low samples can make medians unstable

## Time to Hire

- Formula: median days from application creation to joined status
- Source fields: `Application.createdAt`, joined timestamp from offer/application lifecycle
- Event date used: applied date to actual joining date
- Filters: organization, date range
- Timezone: organization timezone
- Exclusions: non-joined candidates
- Null handling: returns `null` when no qualifying records exist
- Sample-size limitation: affected by long-tail joining dates

## Hiring Velocity

- Formula: joined outcomes per selected period
- Source fields: joined timestamps and organization scope
- Event date used: actual joining date
- Filters: organization, date range, recruiter/job scope where supported
- Timezone: organization timezone
- Exclusions: non-joined outcomes
- Null handling: returns `0`
- Sample-size limitation: use with period context

## Time to Shortlist

- Formula: time from application creation to shortlist stage entry
- Source fields: application timeline or activity timestamps
- Event date used: applied date and first shortlist event
- Filters: organization, date range
- Timezone: organization timezone
- Exclusions: applications never shortlisted
- Null handling: returns `null` when unavailable
- Sample-size limitation: depends on timeline completeness

## Time to Interview

- Formula: time from application creation to first interview scheduling
- Source fields: `Application.createdAt`, first interview scheduled timestamp
- Event date used: applied date to first interview date
- Filters: organization, date range
- Timezone: organization timezone
- Exclusions: applications never scheduled for interview
- Null handling: returns `null` when unavailable
- Sample-size limitation: pipeline timing lag affects interpretation

## Recruiter Workload

- Formula: count of active jobs, ATS applications, or open items attributed to a recruiter
- Source fields: recruiter-scoped job and application ownership fields
- Event date used: current-state metric
- Filters: organization, recruiter
- Timezone: presentation only
- Exclusions: archived/closed records where applicable
- Null handling: returns empty list or `0`
- Sample-size limitation: workload is operational, not an efficiency judgment

## Recruiter Productivity

- Formula: derived from recruiter-scoped throughput metrics such as applications progressed, jobs managed, interviews scheduled, or hires closed
- Source fields: recruiter-linked records from jobs, applications, interviews, offers, joins
- Event date used: depends on the specific throughput metric
- Filters: organization, recruiter, date range
- Timezone: organization timezone
- Exclusions: records outside scope
- Null handling: returns bounded empty results when no scope data exists
- Sample-size limitation: do not over-interpret without volume context

## Aging Jobs

- Formula: days since job creation or publication for still-open jobs
- Source fields: job created/published timestamps and current status
- Event date used: current date minus created/published date
- Filters: organization and supplied scope filters
- Timezone: organization timezone
- Exclusions: closed jobs
- Null handling: returns empty list when none qualify
- Sample-size limitation: none

## Aging Applications

- Formula: days since latest application progression event for still-active applications
- Source fields: application latest activity or timeline timestamp
- Event date used: current date minus latest stage/activity timestamp
- Filters: organization and supplied scope filters
- Timezone: organization timezone
- Exclusions: completed, withdrawn, or fully closed applications where excluded by the view
- Null handling: returns empty list when none qualify
- Sample-size limitation: depends on event completeness

## Requisition Fulfilment

- Formula: requisitions linked to active or filled jobs / requisitions in scope
- Source fields: requisitions, linked jobs, fulfilment statuses
- Event date used: requisition state and link state
- Filters: organization and supplied scope filters
- Timezone: organization timezone
- Exclusions: none by default
- Null handling: current implementation may return `null` where the data path is not yet complete
- Sample-size limitation: metric should be treated as baseline until broader workflow coverage is added

## Source Effectiveness

- Formula: source-specific counts and downstream conversions
- Source fields: application source attribution, downstream interview/offer/joining linkage
- Event date used: application created date for baseline attribution
- Filters: organization and selected date range
- Timezone: organization timezone
- Exclusions: unattributed legacy records may be omitted or grouped separately
- Null handling: empty list when source attribution is unavailable
- Sample-size limitation: source comparisons are unreliable for sparse data
