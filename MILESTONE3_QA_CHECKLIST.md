# Milestone 3 QA Checklist

Date: Tuesday, July 21, 2026

## Recruiter Interview Workflow

- Status: □ Pass □ Fail □ N/A
  Notes: Open a recruiter ATS application that already exists and confirm the interview plan section renders.

- Status: □ Pass □ Fail □ N/A
  Notes: Create an interview plan with an initial round and confirm the round appears immediately on the ATS application detail page.

- Status: □ Pass □ Fail □ N/A
  Notes: Add a second round to the same interview process and confirm the sequence order is preserved.

- Status: □ Pass □ Fail □ N/A
  Notes: Use “Repeat round” and confirm a duplicate round is created without overwriting the original round.

- Status: □ Pass □ Fail □ N/A
  Notes: Schedule a round with timezone, meeting mode, meeting link, office address, candidate instructions, and panel members.

- Status: □ Pass □ Fail □ N/A
  Notes: Reschedule the same round and confirm ATS activity reflects a reschedule event and the round shows an incremented reschedule count.

- Status: □ Pass □ Fail □ N/A
  Notes: Cancel a scheduled round and confirm the cancellation reason is stored and visible in the ATS application view.

## Panel Management

- Status: □ Pass □ Fail □ N/A
  Notes: Assign a lead interviewer and at least one additional interviewer from the same organisation.

- Status: □ Pass □ Fail □ N/A
  Notes: Attempt to assign a duplicate panel member and confirm validation blocks it.

- Status: □ Pass □ Fail □ N/A
  Notes: Attempt to assign a non-member or cross-organisation user and confirm the backend rejects it safely.

## Feedback Workflow

- Status: □ Pass □ Fail □ N/A
  Notes: Submit draft feedback for a round and confirm the ATS activity timeline reflects a drafted feedback event.

- Status: □ Pass □ Fail □ N/A
  Notes: Submit finalized feedback and confirm it becomes locked from further modification.

- Status: □ Pass □ Fail □ N/A
  Notes: Confirm round feedback cards show reviewer identity, recommendation, score, and written summary.

## Hiring Decisions

- Status: □ Pass □ Fail □ N/A
  Notes: Apply `MOVE_NEXT_ROUND` and confirm the ATS activity shows progression to the next configured round.

- Status: □ Pass □ Fail □ N/A
  Notes: Apply `REJECT` and confirm the application stage and candidate-visible timeline are updated safely.

- Status: □ Pass □ Fail □ N/A
  Notes: Apply `READY_FOR_OFFER` and confirm the ATS stage moves into the post-interview state without invoking an offer module.

## Candidate Experience

- Status: □ Pass □ Fail □ N/A
  Notes: Open the candidate dashboard and confirm upcoming interviews render from real data.

- Status: □ Pass □ Fail □ N/A
  Notes: Open the candidate application detail page and confirm upcoming and past interview sections render.

- Status: □ Pass □ Fail □ N/A
  Notes: Confirm candidate-visible interview details include status, instructions, meeting link when present, panel members, reschedule count, and cancellation reason where applicable.

## Timeline, Notifications, and Calendar

- Status: □ Pass □ Fail □ N/A
  Notes: Confirm ATS activity includes interview scheduled, updated, cancelled, feedback, and decision events.

- Status: □ Pass □ Fail □ N/A
  Notes: Confirm candidate-visible application timeline includes safe interview updates without internal recruiter notes.

- Status: □ Pass □ Fail □ N/A
  Notes: Download the ICS file for a scheduled round and confirm the calendar file opens with summary, schedule, and location details.

- Status: □ Pass □ Fail □ N/A
  Notes: Schedule a round within 24 hours and confirm reminder notifications are generated.

- Status: □ Pass □ Fail □ N/A
  Notes: Schedule a round within 1 hour and confirm reminder notifications are generated.

## Security and Isolation

- Status: □ Pass □ Fail □ N/A
  Notes: Verify unauthenticated access to interview routes is denied.

- Status: □ Pass □ Fail □ N/A
  Notes: Verify cross-organisation access to interview rounds, feedback, and calendar export is denied safely.

- Status: □ Pass □ Fail □ N/A
  Notes: Verify candidate-visible interview pages do not expose recruiter internal notes, panel-only commentary, or unrelated organisation data.

## UX, Refresh, and Reliability

- Status: □ Pass □ Fail □ N/A
  Notes: Refresh the recruiter ATS application detail page after each interview action and confirm state remains consistent.

- Status: □ Pass □ Fail □ N/A
  Notes: Verify direct links to `/recruiter/ats/[applicationId]` and `/candidate/applications/[applicationId]` load correctly.

- Status: □ Pass □ Fail □ N/A
  Notes: Verify mobile and tablet layouts remain usable for the ATS application detail and candidate application detail pages.

- Status: □ Pass □ Fail □ N/A
  Notes: Confirm there are no console errors, hydration warnings, or broken form submissions during the interview workflow.
