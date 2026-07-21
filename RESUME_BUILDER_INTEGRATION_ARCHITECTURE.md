# Resume Builder Integration Architecture

## 1. Product Separation Decision

Careeriz does not ship a native Resume Builder. Resume creation and editing belong to a future standalone Resume Builder SaaS product. Careeriz is responsible only for resume assets, resume metadata, application resume selection, and safe outbound integration.

## 2. Careeriz Responsibilities

- candidate resume upload and storage metadata
- candidate resume parsing status and parsed suggestions
- primary-resume selection
- resume selection at application time
- external Resume Builder entry points
- future identity and synchronization boundary

## 3. Resume Builder SaaS Responsibilities

- resume authoring
- resume templates and layout
- resume editing/versioning UX
- future standalone billing/subscription concerns
- future authoring APIs and webhook callbacks

## 4. Current Deep-Link Integration

Current integration is centralized in `backend/src/services/resumeBuilderService.js`.

- Create Resume: `{RESUME_BUILDER_BASE_URL}/create?source=careeriz`
- Edit Resume: `{RESUME_BUILDER_BASE_URL}/resume/{externalResumeId}/edit`
- Manage Resumes: `{RESUME_BUILDER_BASE_URL}/dashboard?source=careeriz`

No sensitive candidate data is placed in query parameters.

## 5. Environment Configuration

Supported configuration:

- `RESUME_BUILDER_ENABLED`
- `RESUME_BUILDER_BASE_URL`
- `RESUME_BUILDER_CLIENT_ID`

The base URL is validated server-side. When the integration is disabled or unconfigured, Careeriz shows a safe disabled state instead of a broken link.

## 6. Safe Redirect Validation

Careeriz validates the configured origin and any stored external resume URL against the configured Resume Builder origin before returning edit/manage links. Unsafe or cross-origin destinations are rejected. Raw tokens, candidate PII, and storage internals are not embedded into outbound links.

## 7. External Resume Metadata

`ResumeAsset` now stores external-builder metadata where available:

- `source`
- `externalResumeId`
- `externalResumeUrl`
- `externalResumeVersion`
- `lastSynchronizedAt`

This keeps candidate-facing resume selection and recruiter-facing resume references compatible with future synchronization.

## 8. Future SSO Options

Supported future evolution paths:

1. Deep link only
2. Short-lived signed handoff token
3. OAuth or OpenID Connect
4. Shared identity provider

Milestone 5 implements only option 1.

## 9. Future API Synchronization

Planned future capabilities:

- pull external resume metadata into Careeriz
- sync new external versions into `ResumeAsset`
- let candidates choose an external-builder version as primary

No direct API synchronization is implemented in Milestone 5.

## 10. Future Webhook Architecture

Future webhooks may publish:

- resume created
- resume updated
- resume version published
- resume archived

Careeriz should receive those events through a dedicated authenticated integration endpoint that maps the external identity to the local candidate profile and creates or updates `ResumeAsset` records safely.

## 11. Candidate Identity Mapping

Milestone 5 does not implement shared authentication. Candidate identity mapping is currently implicit: the signed-in Careeriz candidate chooses outbound links, and external resume IDs can later be stored against that candidate’s `ResumeAsset`.

## 12. Resume Version Mapping

Careeriz treats each uploaded or externally linked resume as a `ResumeAsset`. For external-builder resumes:

- `externalResumeId` identifies the external resume
- `externalResumeVersion` identifies the selected version where available
- `lastSynchronizedAt` marks the last trusted metadata sync point

## 13. Security Risks

- unsafe redirect or open-redirect risk if external URLs are not validated
- accidental PII leakage if outbound links include candidate data
- stale external version references if synchronization is added later without version checks
- token leakage risk if future SSO handoff is introduced without hashing/expiry constraints

Milestone 5 mitigates the current deep-link risks by centralizing URL generation and validating origin.

## 14. Data Ownership Boundaries

- Careeriz owns candidate profile data, resume asset metadata, parsing state, and application linkage
- Resume Builder SaaS will own authoring-specific content, layout, and edit history
- Careeriz does not expose recruiter-only data to the Resume Builder
- Resume Builder should not mutate Careeriz candidate/application state directly without future authenticated APIs

## 15. Failure and Disabled States

When Resume Builder is disabled or unconfigured:

- Careeriz continues to support uploaded resumes
- candidate-facing pages show a disabled external-builder state
- no broken navigation is exposed

When an external resume URL is invalid:

- link generation is rejected server-side
- Careeriz falls back to standard uploaded resume workflows

## 16. Migration from Deep Links to Full Integration

Recommended progression:

1. Current state: deep-link only
2. Add signed handoff token with strict expiry and hashing
3. Add shared identity or OAuth/OIDC
4. Add resume metadata sync APIs
5. Add webhook callbacks
6. Add version reconciliation and conflict handling

Milestone 5 intentionally stops at step 1.
