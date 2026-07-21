# RBAC Architecture

## Overview

Careeriz uses authenticated user identity, organization membership, and permission helpers to enforce multi-tenant access across recruiter, admin, ATS, interview, offer, and intelligence workflows.

## Core Roles

User roles include at least:

- candidate
- recruiter
- admin/platform-admin-capable role paths where applicable

Organization membership roles include:

- `OWNER`
- `ADMIN`
- `RECRUITER`
- `HIRING_MANAGER`
- `INTERVIEWER`
- `VIEWER`

Custom organization role definitions can extend permission sets through `OrganisationRoleDefinition`.

## Permission Enforcement

Central permission mapping lives in `backend/src/services/enterprisePermissionService.js`.

Key categories include:

- organization management
- user and membership administration
- settings and workflow administration
- audit access
- feature flags
- analytics
- intelligence permissions

## Intelligence Permissions

Milestone 7 adds:

- `intelligence.resume.read`
- `intelligence.resume.generate`
- `intelligence.match.read`
- `intelligence.match.generate`
- `intelligence.job.generate`
- `intelligence.interview.generate`
- `intelligence.search.use`
- `intelligence.analytics.use`
- `intelligence.governance.read`
- `intelligence.governance.manage`

## Feature Flags and Permissions

Sensitive capabilities such as intelligence features require:

- authenticated user
- organization membership
- permission check
- relevant feature flag where enforced

## Known Gap

Some legacy recruiter modules still use older role-based checks instead of the newest unified field-level permission approach. This remains a known issue rather than an active regression.
