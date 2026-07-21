# Google Workspace Setup

## Required Environment Variables

- `GOOGLE_MEETING_ENABLED=true`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `PUBLIC_APP_URL`
- `MEETING_TOKEN_ENCRYPTION_KEY`

## Redirect URI

Use:

- `/api/meeting-providers/callback/GOOGLE_MEET`

Example local value:

- `http://localhost:5000/api/meeting-providers/callback/GOOGLE_MEET`

## Scope Expectations

Careeriz expects Google Calendar access sufficient for:

- calendar event creation
- attendee updates
- free/busy checks where allowed
- Google Meet conference generation through Calendar conference data

## Operational Notes

- Meet URLs are generated through Google Calendar conference creation, not by fabricating URLs.
- Production should fail startup when Google integration is enabled without required configuration or encryption key.
- Live validation was not performed in this environment because no real Google credentials were configured.
