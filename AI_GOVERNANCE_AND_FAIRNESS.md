# AI Governance and Fairness

## 1. Human-in-the-Loop Policy

Careeriz intelligence assists humans. It does not make final hiring, rejection, shortlisting, offer, or stage-movement decisions.

## 2. Prohibited Decisions

The system must not:

- automatically reject candidates
- automatically hire candidates
- automatically move ATS stages based on provider output alone
- automatically publish job descriptions
- automatically determine compensation or joining decisions

## 3. Prohibited Attributes

Careeriz intelligence must not use or infer:

- race
- religion
- caste
- ethnicity
- gender
- health
- disability
- pregnancy
- sexual orientation
- political belief
- marital status
- age
- personality fit
- culture fit

## 4. Sensitive-Data Handling

Before provider execution, Careeriz excludes or redacts:

- email where unnecessary
- phone where unnecessary
- exact address
- authentication data
- tokens
- financial account data
- protected and prohibited attributes

## 5. Candidate Transparency

Generated outputs are clearly labeled as machine-generated suggestions. Candidate-facing flows do not expose recruiter-only internal assessment details.

## 6. Recruiter Responsibility

Recruiters remain responsible for:

- reviewing generated content
- validating match explanations
- following employment-law restrictions
- avoiding prohibited interview questions
- making final hiring decisions

## 7. Explainability

Candidate-job matching always preserves a deterministic baseline with explicit subscore categories and missing-criteria lists. Provider assistance may explain; it does not replace the transparent baseline.

## 8. Overrides

Where intelligence influences review, the architecture supports human feedback and override reasons. Human judgment remains authoritative.

## 9. Auditability

Every intelligence execution records:

- organization
- requester
- feature
- prompt key and version
- provider
- model
- latency
- cache state
- failure code where applicable

## 10. Retention

Governance records store safe metadata, normalized outputs, and fingerprints rather than raw secret-bearing prompt history. Future retention policies should define age-based purging for expired results and stale executions.

## 11. Provider Data Policy

Careeriz only sends the minimum projected data required for the capability. Providers do not receive unrestricted database records, credentials, or organization-private tokens.

## 12. Bias Evaluation

Milestone 7 establishes the architecture for fairness-safe prompting, explicit prohibited attributes, deterministic scoring rules, and feedback capture. Formal bias evaluation datasets and scorecards remain a future enhancement.

## 13. Model Change Management

Prompt versions are explicit and provider/model choice is recorded per execution. Future model changes should be reviewed through controlled rollout, regression testing, and legal/policy signoff where required.

## 14. Incident Handling

If a provider misbehaves or a prompt issue is discovered:

- disable the feature via flags
- disable the provider globally via configuration
- review execution and feedback records
- regenerate impacted results only after the fix is validated

## 15. Legal Review Requirements

Any future expansion into automated decision support, compensation recommendations, public profile inference, or new jurisdictions should undergo legal and policy review before release.
