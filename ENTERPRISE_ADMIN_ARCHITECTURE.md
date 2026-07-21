# Enterprise Admin Architecture

## Existing Architecture Reviewed

Milestone 6 extends the existing Careeriz multi-tenant platform rather than replacing it. The implementation reuses:

- JWT authentication and existing session invalidation
- organisation membership and organisation-scoped access rules
- `WorkspaceShell` and existing recruiter/admin navigation patterns
- existing audit log infrastructure
- existing notification infrastructure
- existing ATS, interview, offer, and candidate workflow data
- shared schema validation from `@careeriz/shared`
- existing Prisma naming, enum, and relation conventions
- existing Express controller and service architecture

Core enterprise additions live in:

- `backend/src/services/enterprisePermissionService.js`
- `backend/src/services/adminService.js`
- `backend/src/controllers/adminController.js`
- `backend/src/routes/adminRoutes.js`
- `frontend/app/admin/**`
- `shared/src/admin.js`

## Organization Model

The organisation remains the primary tenant boundary.

Extended organisation capabilities:

- organisation profile updates
- archive and restore
- organisation-level onboarding completion marker
- organisation structure via `OrganisationUnit`
- organisation configuration via `OrganisationSettings`
- organisation-specific notification templates via `NotificationTemplate`
- organisation-specific feature flags via `FeatureFlag`
- organisation-scoped custom role definitions via `OrganisationRoleDefinition`

`OrganisationUnit` supports:

- business units
- departments
- divisions
- office locations
- cost centers
- legal entities
- parent-child hierarchy

## RBAC Model

The admin surface uses a centralized permission model instead of scattering new role checks.

System organization roles:

- `OWNER`
- `ADMIN`
- `RECRUITER`
- `HIRING_MANAGER`
- `INTERVIEWER`
- `VIEWER`

Platform user roles:

- `RECRUITER`
- `CANDIDATE`
- `ADMIN`

`enterprisePermissionService` resolves:

- actor organisation context
- platform-admin override context
- system-role default permission bundles
- custom-role permission overlays through `OrganisationMembership.customRoleDefinitionId`

## Permission Hierarchy

Enterprise permissions currently include:

- `admin.dashboard.read`
- `organisation.profile.manage`
- `organisation.structure.manage`
- `organisation.settings.manage`
- `organisation.workflow.manage`
- `organisation.audit.read`
- `organisation.analytics.read`
- `organisation.users.read`
- `organisation.users.manage`
- `organisation.users.transfer_ownership`
- `organisation.roles.read`
- `organisation.roles.manage`
- `organisation.notifications.manage`
- `organisation.flags.manage`
- `organisation.lookups.manage`

Permission resolution order:

1. authenticated actor
2. organisation membership or platform-admin context
3. system-role default permissions
4. custom role definition permissions if attached to the membership
5. route-level permission requirement

Trade-off:

- The new admin surface is centralized on enterprise permissions.
- Some older recruiter modules still use pre-existing role arrays and should be consolidated in a future hardening milestone.

## Audit Architecture

Milestone 6 reuses `recordAuditLog` and adds admin audit events for:

- organisation profile update
- organisation archive and restore
- organisation structure update and archive
- membership update
- ownership transfer
- bulk invitation creation
- bulk user status and role updates
- role definition create and update
- settings update
- workflow update
- notification template create and update
- feature flag create and update
- lookup update

Audit center behavior:

- filters by user, entity, action, date range, and free-text search
- remains organisation-scoped for org administrators
- exposes real persisted audit rows
- preserves safe error handling

## Notification Administration

Notification administration is organization-scoped and built on `NotificationTemplate`.

Supported fields:

- template key
- category
- channel
- subject
- body
- enabled flag

The current baseline supports:

- listing templates
- updating or creating templates
- previewing content with simple organisation placeholders

It intentionally does not build a separate mail delivery system.

## Analytics Architecture

Enterprise analytics reuses existing platform data. Metrics are computed from persisted records for:

- active jobs
- draft jobs
- applications
- interviews
- offers
- accepted offers
- joined outcomes
- pending invitations
- active members

The background-jobs dashboard is intentionally observational only. It summarizes:

- resume parsing backlog signals
- offer expiry signals
- interview reminder signals
- notification template count
- feature-flag count

No worker or queue framework is introduced in Milestone 6.

## Feature Flags

Feature flags are organization-scoped and stored in `FeatureFlag`.

Current design:

- key
- description
- enabled
- updated-by metadata
- uniqueness per organization and key

This is intentionally billing-agnostic and future-ready for entitlement layering.

## Future Billing Integration Points

Billing is out of scope, but future integration can attach at:

- organisation-level entitlements
- feature-flag gating
- user-seat enforcement
- analytics quotas
- branded notification or career-site limits

No billing logic was added in Milestone 6.

## Future SSO

Current auth remains JWT plus existing OAuth paths. Future enterprise SSO can layer onto:

- `User`
- `OrganisationMembership`
- admin permission resolution
- invitation acceptance
- login-session invalidation

Suggested future additions:

- organization SSO configuration model
- identity provider metadata
- JIT membership mapping rules
- org-scoped login enforcement policies

## Future SCIM Provisioning

The current admin data model is compatible with future SCIM-style provisioning through:

- user status fields
- organisation membership roles
- custom role definitions
- invitation and membership auditability

Suggested future layer:

- external identity link table
- inbound provisioning event processor
- conflict-safe membership reconciliation

## Future SAML Support

SAML is not implemented. The current separation of user identity, membership, and organization permission evaluation keeps a clear path for:

- organisation-scoped SAML config
- attribute-to-role mapping
- JIT provisioning into `OrganisationMembership`
- audit events around SAML-authenticated sessions

## Known Risks and Trade-offs

- Field-level permission enforcement is modeled for the admin layer, but not yet consistently enforced across every legacy recruiter module.
- Settings and workflow forms are pragmatic JSON-backed editors, not guided enterprise designers.
- The background-jobs dashboard is intentionally informational only and does not imply operational worker automation.
- Platform-wide create-organisation and cross-tenant super-admin ergonomics can still be expanded.
