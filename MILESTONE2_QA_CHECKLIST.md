# Milestone 2 QA Checklist

Date: Monday, July 20, 2026
Scope: Recruiter Workflow Completion

## Recruiter Registration

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Verify recruiter account creation still succeeds and does not create duplicate organisations on refresh/retry.

## Workspace Onboarding

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm `/recruiter/onboarding` loads existing organisation data and saves updated organisation/recruiter details.

## Onboarding Repeat Access

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  After completion, revisit `/recruiter/onboarding` and confirm redirect to `/recruiter`.

## Invitation Creation

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Create a workspace invitation from `/recruiter/members` as an owner/admin and confirm pending invitation appears.

## Invitation Email / Link

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm the invitation email contains the `/auth/invitations/accept` link and does not expose raw token data outside the link itself.

## Acceptance by Existing User

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Sign in as an existing recruiter matching the invite email, accept, and confirm redirect into recruiter workspace.

## Acceptance by New User

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Register/sign in as a new recruiter matching the invite email, accept, and confirm membership is created once.

## Expired Invitation

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Verify expired invite shows safe failure messaging and cannot be accepted.

## Revoked Invitation

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Revoke a pending invitation and confirm it cannot be accepted afterward.

## Duplicate Invitation

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Attempt a second active invite for the same organisation/email and confirm it is rejected safely.

## Members Permissions

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Verify owner/admin can invite/resend/revoke and lower-permission recruiters cannot.

## Requisition Creation

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm requisitions still load and approved requisitions expose continuity actions.

## Job Creation from Requisition

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Open job creation from a requisition, verify fields prefill, and confirm duplicate linked job creation is blocked.

## Job Publishing

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Create/update/open/close/archive a recruiter job and verify no role or ownership regression.

## Resume Search from Job

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Open Resume Search from a job or requisition-linked job and confirm job/requisition context is visible.

## Add to ATS

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Add a resume-search candidate into ATS for the active job and verify duplicate prevention.

## Bulk Partial Failure

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Execute a bulk action where at least one item fails or duplicates; confirm success and failure counts are both shown.

## Dashboard Metrics

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm dashboard metrics are real-data based and pending invitations are reflected.

## Responsive Layout

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Check recruiter onboarding, members, requisitions, jobs, database, and ATS on narrow widths.

## Direct Links

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Open `/recruiter/onboarding`, `/recruiter/members`, `/recruiter/requisitions`, `/recruiter/database?jobId=...`, and invitation-accept links directly.

## Refresh

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Refresh recruiter workflow pages and confirm workspace context remains stable.

## Console Errors

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm no browser console errors on recruiter workflow pages.

## Network Errors

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Confirm failures surface safe error messages without leaking internal details.

## Cross-Organization Access

- Status: `□ Pass  □ Fail  □ N/A`
  Notes:
  Verify recruiters cannot view/manage invitations, members, jobs, ATS records, or candidate data from another organisation.
