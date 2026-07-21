# Zoom Setup

## Required Environment Variables

- `ZOOM_MEETING_ENABLED=true`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_OAUTH_REDIRECT_URI`
- `PUBLIC_APP_URL`
- `MEETING_TOKEN_ENCRYPTION_KEY`

## Redirect URI

Use:

- `/api/meeting-providers/callback/ZOOM`

Example local value:

- `http://localhost:5000/api/meeting-providers/callback/ZOOM`

## Integration Notes

- OAuth-based Zoom integration only
- deprecated JWT auth is not used
- candidate-safe join URLs are stored
- host/start URLs are encrypted or omitted from broad access

## Operational Notes

- Zoom waiting room defaults can be controlled through organization scheduling settings.
- Live validation was not performed in this environment because no real Zoom credentials were configured.
