# Offer Module Architecture

Date: Tuesday, July 21, 2026

## 1. Existing Architecture Reviewed

Milestone 4 builds on the existing:

- recruiter and candidate authentication
- organisation-scoped authorization helpers
- ATS `Application` plus candidate-facing `JobApplication`
- interview lifecycle and `READY_FOR_OFFER` decision handoff
- notification service
- audit logging service
- recruiter and candidate application detail surfaces

No parallel ATS or application model was introduced.

## 2. Offer Domain Model

Primary models added:

- `Offer`
- `OfferComponent`
- `OfferApproval`
- `OfferAccessToken`
- `OfferComment`

Key relations:

- `Offer` belongs to `Organisation`, `Application`, `Job`, and `CandidateProfile`
- `Offer` versions are linked with `previousOfferId`
- released supersession is tracked with `supersededByOfferId`
- approval steps are sequenced per offer
- access tokens are hashed and scoped to one offer version

## 3. State Machine

Implemented offer states:

- `DRAFT`
- `PENDING_APPROVAL`
- `CHANGES_REQUESTED`
- `APPROVED`
- `RELEASED`
- `VIEWED`
- `ACCEPTED`
- `REJECTED`
- `WITHDRAWN`
- `EXPIRED`
- `SUPERSEDED`
- `JOINING_CONFIRMED`
- `JOINED`
- `NO_SHOW`
- `DEFERRED`

Primary transitions:

- `DRAFT` -> `PENDING_APPROVAL`
- `DRAFT` -> `WITHDRAWN`
- `PENDING_APPROVAL` -> `APPROVED`
- `PENDING_APPROVAL` -> `CHANGES_REQUESTED`
- `APPROVED` -> `RELEASED`
- `RELEASED` -> `VIEWED`
- `RELEASED` or `VIEWED` -> `ACCEPTED`
- `RELEASED` or `VIEWED` -> `REJECTED`
- `RELEASED` or `VIEWED` -> `CHANGES_REQUESTED`
- `ACCEPTED` -> `JOINING_CONFIRMED`
- `ACCEPTED` or `JOINING_CONFIRMED` -> `DEFERRED`
- `ACCEPTED` or `JOINING_CONFIRMED` or `DEFERRED` -> `JOINED`
- `ACCEPTED` or `JOINING_CONFIRMED` or `DEFERRED` -> `NO_SHOW`
- `RELEASED` or `VIEWED` -> `EXPIRED` by safe on-access expiry evaluation
- previous released version -> `SUPERSEDED` only when a new version is validly released

## 4. Permissions Matrix

- Recruiter write actions: `OWNER`, `ADMIN`, `RECRUITER`, `HIRING_MANAGER`
- Recruiter read actions: recruiter write roles plus `INTERVIEWER`, `VIEWER`
- Candidate authenticated view/actions: candidate must own the related `CandidateProfile`
- Public token view/actions: token must be valid, unrevoked, unconsumed, and unexpired
- Approval action: actor must be the active approver for the current sequence step

## 5. Approval Model

- approval chains are explicit per offer version
- approvers must be active organisation members
- creator self-approval is blocked
- out-of-order approvals are rejected
- release is blocked unless every approval is `APPROVED`
- change requests return the offer to `CHANGES_REQUESTED`

## 6. Versioning Model

- every revision is a new `Offer` row with a higher `version`
- `previousOfferId` links revision lineage
- old released offers remain intact until a new version is released
- only then does the previous released version become `SUPERSEDED`
- candidate sees the current active version by default
- recruiter can see version history on the ATS application detail page

## 7. Candidate Secure-Access Model

- release generates a cryptographically secure random token
- only the SHA-256 token hash is stored
- raw tokens are not persisted or logged
- token access is scoped to one offer version
- token actions are invalid after expiry, revocation, or consumption
- authenticated candidate access is also supported at `/candidate/offers/[offerId]`

## 8. Compensation Design

- top-level compensation supports annual, fixed, variable, joining bonus, retention bonus, allowances, and other compensation
- `totalCompensation` is normalized server-side
- `OfferComponent` supports additional custom line items
- numeric validation rejects negative values and inconsistent annual/fixed/variable totals

## 9. Document Generation

- offer PDFs are generated server-side with `pdfkit`
- no client HTML is executed
- output is deterministic for each version
- internal notes are excluded from the PDF
- candidate and recruiter PDF downloads use separate authorized routes

## 10. ATS/Application Mapping

No new ATS enum pipeline was created.

Current mapping strategy:

- `Application.currentStage` remains on the existing enum
- offer and joining states are reflected through `Application.statusLabel`
- `REJECTED`, `WITHDRAWN`, `EXPIRED`, and `NO_SHOW` collapse to recruiter-facing closed status via the existing model
- release, acceptance, revision, joining, and supersession events are appended to ATS activity and candidate timeline records

## 11. Notifications

Implemented notification categories:

- offer approval pending
- offer approved
- offer released
- offer viewed
- offer accepted
- offer rejected
- offer revision requested
- offer withdrawn
- joining status changes

Candidate email delivery:

- offer release email with secure link
- basic status emails for withdrawal

## 12. Audit Events

Sensitive offer actions create audit logs:

- draft create/update
- approval request
- approve/request changes/reject
- release
- revision create
- withdrawal
- candidate accept/reject/request revision
- joining lifecycle updates
- on-access expiry resolution

## 13. Background-Processing Limitations

- no queue or worker was introduced
- expiry is resolved safely on access
- reminder scheduling is not operational yet
- this preserves the known Milestone 3 reminder limitation for interviews

## 14. Future E-Signature Integration Points

The current release flow leaves a clean boundary for future providers:

- tokenized candidate access URL
- deterministic PDF generation
- version-specific document identity
- candidate response transitions isolated in offer service methods

No DocuSign, Zoho Sign, or Adobe Sign integration was added.

## 15. Known Risks and Trade-offs

- `Application` and `JobApplication` overlap remains a long-term maintenance concern
- dashboard metrics now fall back to zero if offer or invitation tables are absent in an unmigrated environment
- automated expiry/reminder workers are still deferred
- organisation-level template management is still a single default-template baseline, not a full designer
