# Milestone 7 QA Checklist

Status:
□ Pass
□ Fail
□ N/A

Notes:

## Provider and Configuration

- Intelligence disabled state
- Configured provider state
- Missing API key handling
- Invalid provider base URL
- Provider timeout handling
- Unavailable provider handling
- Feature flag disabled state
- Permission denied state
- Organization usage limit exceeded

## Resume Intelligence

- Summary generation
- Skill extraction
- Malformed resume content handling
- Very large resume handling
- Stale resume result refresh
- Regenerate flow
- Feedback submission
- Candidate isolation
- Prompt-injection text in resume content

## Candidate Matching

- Strong match scenario
- Weak match scenario
- Missing required skill handling
- Incomplete candidate profile
- Incomplete job profile
- Batch scoring guardrails
- Human override logging where applicable
- Stale score refresh
- Deterministic result with provider disabled

## Job Intelligence

- Draft description generation
- Improve description flow
- Accept selected generated section
- Reject generation without persistence
- Regenerate
- No automatic save
- No automatic publish
- Exclusionary wording warning

## Interview Intelligence

- Technical questions generation
- Behavioural questions generation
- Rubric generation
- Notes summary generation
- Conflicting feedback summary
- Candidate cannot see recruiter-only intelligence
- Prohibited question/topic filtering

## Natural-Language Talent Search

- Natural-language search input
- Interpreted filter display
- Manual filter editing after parse
- Invalid filter rejection
- No-result state
- Pagination continuity
- Organization isolation

## Analytics and Insights

- Funnel metrics
- Time-to-hire metrics
- Offer acceptance rate
- Source effectiveness output
- Date-filter handling
- Organization timezone handling
- Generated insight
- Metric references shown
- Insufficient-data state
- No unsupported causal overclaim

## Admin Governance

- Usage summary
- Recent executions list
- Failure list
- Prompt version visibility
- Feature enable/disable behavior
- Provider health visibility
- Emergency disable behavior
- No API-key exposure

## General

- Browser refresh
- Deep links
- Browser back behavior
- Mobile layout
- Tablet layout
- Keyboard accessibility
- Console errors
- Network failure handling
- Audit entries
- Safe logging verification
- Rate limits
- Cache-hit behavior
