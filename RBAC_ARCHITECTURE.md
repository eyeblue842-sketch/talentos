# RBAC Architecture

## Overview

Careeriz uses organization-scoped RBAC with:

- system roles
- organization membership roles
- permission mappings in backend services
- frontend route affordances that mirror, but do not replace, backend authorization

## Core Roles

- `OWNER`
- `ADMIN`
- `RECRUITER`
- `HIRING_MANAGER`
- `INTERVIEWER`
- `VIEWER`

Platform admin controls remain separate from organization membership.

## Permission Enforcement

Permissions are centralized through `backend/src/services/enterprisePermissionService.js` and shared admin schema contracts.

## Interview Scheduling Permissions

Milestone 8.5 adds:

- `interview.schedule`
- `interview.reschedule`
- `interview.cancel`
- `interview.view`
- `interview.join`
- `interview.manageParticipants`
- `interview.reviewRescheduleRequest`
- `interview.overrideConflict`
- `interview.markNoShow`
- `meetingProvider.manage`
- `meetingProvider.viewStatus`
- `meetingProvider.disconnect`
- `schedulingSettings.manage`
- `schedulingAudit.view`

## Scheduling Access Rules

- candidate access is limited to the candidate’s own interviews
- interviewer access is limited to explicit participant assignment or existing allowed role context
- provider connection management is organization-admin scoped
- provider host URLs are never exposed to general recruiter/interviewer/candidate serializers

## Feature Flags and Permissions

Scheduling is not feature-flagged separately in the current milestone. Access is governed by:

- organization membership
- role permissions
- organization settings for allowed providers and reschedule rules

## Known Gaps

- legacy recruiter pages still contain some coarse-grained role assumptions in UI affordances
- interviewer-specific standalone workspace polish remains limited; the backend permission model is stronger than the current dedicated UI surface
