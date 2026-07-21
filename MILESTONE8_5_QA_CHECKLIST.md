# Milestone 8.5 QA Checklist

Mark each item:

- `□ Pass`
- `□ Fail`
- `□ N/A`

## Requires Real Provider Credentials

- Google OAuth setup
- Zoom OAuth setup
- Google Meet creation
- Zoom meeting creation
- provider reconnection
- token refresh
- provider failure retry after a simulated external error

## Scheduling Modes

- custom HTTPS link
- office interview
- phone interview
- single interviewer
- multiple interviewers
- panel interview
- optional interviewer
- recruiter included in invite
- coordinator included in invite

## Calendar and Invitations

- recruiter ICS download
- candidate ICS download
- Outlook import
- Google Calendar import
- Apple Calendar import
- invitation update after reschedule
- cancellation ICS

## Candidate Experience

- candidate upcoming interview card
- safe join button
- cancelled interview state
- reschedule request submission
- reschedule request withdrawal
- status display after recruiter decision

## Interviewer Experience

- assigned interview list
- join action
- conflict visibility
- reschedule request submission

## Recruiter Experience

- schedule from ATS
- conflict preview
- conflict override
- recruiter direct reschedule
- reviewer approval of candidate request
- reviewer rejection of candidate request
- interviewer replacement without time change
- cancellation
- retry after provider failure

## Time and Reminders

- timezone conversion
- daylight-saving edge case
- old reminders cancelled after reschedule
- new reminders created after reschedule
- reminders cancelled after cancellation

## Security and Isolation

- organization isolation
- permissions
- unauthorized calendar download
- token security
- host URL not exposed
- passcode not leaked

## General

- audit history
- provider health status
- mobile responsiveness
- keyboard accessibility
- console errors
- network error handling
