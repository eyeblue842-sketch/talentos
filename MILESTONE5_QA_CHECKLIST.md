# Milestone 5 QA Checklist

Status:
□ Pass
□ Fail
□ N/A

Notes:

## Candidate onboarding

- New candidate onboarding completes with persisted progress
- Resume onboarding state survives logout/login
- Optional fields can be skipped
- Existing profile data is prepopulated
- Onboarding completion state is retained after refresh

## Candidate dashboard

- Profile completion percentage renders
- Recent applications use real data
- Upcoming interviews render from real interview data
- Active offers render from real offer data
- Saved jobs render from persisted data
- Notifications render from persisted data
- Empty states render cleanly for new candidates

## Profile

- Edit basic information
- Add experience
- Edit experience
- Delete experience
- Add education
- Add skills
- Invalid date validation is shown
- URL validation is shown
- Privacy settings persist

## Resume management

- Upload PDF
- Upload DOCX
- Reject invalid extension
- Reject oversized file
- Set primary resume
- Replace resume
- Archive resume
- Delete resume
- Download owned resume
- Resume ownership isolation is enforced
- Select resume for application

## Resume Builder

- Configured external link opens correctly
- Disabled configuration state renders safely
- Create Resume link works
- Edit external resume link works when metadata exists
- Unsafe redirect prevention blocks invalid URL state
- No personal data appears in query string

## Jobs

- Keyword search
- Location filter
- Work-mode filter
- Employment-type filter
- Pagination
- Clear filters
- Save job
- Remove saved job
- Closed job behavior

## Applications

- Apply to open job
- Resume selection during apply
- Screening answers persist
- Duplicate prevention works
- Confirmation renders
- Candidate-safe timeline renders
- Withdrawal works
- Rejected application renders safely
- Interview-stage application renders safely
- Offer-stage application renders safely

## Interview Center

- Upcoming interview renders
- Meeting link opens
- Timezone renders
- Reschedule history renders
- Cancelled interview renders
- ICS download works
- Internal notes remain hidden

## Offer Center

- Active offer renders
- Offer PDF download works
- Accept works
- Reject works
- Revision request works
- Expired offer renders correctly
- Superseded offer history renders correctly
- Joining status renders
- Internal approval notes remain hidden

## Notifications

- Unread count renders
- Mark read works
- Mark all read works
- Deep links route correctly
- Preference changes persist

## Account

- Password flow routes to existing auth flow
- Profile visibility persists
- Account deactivation request works
- Data export works
- Security error handling is safe

## General

- Refresh on candidate routes
- Deep links open correctly
- Mobile view remains usable
- Tablet view remains usable
- Keyboard navigation works
- No console errors
- Network errors show safe UI
- Candidate isolation is enforced
- Recruiter authorization remains correct
- Browser back/forward behavior is stable
