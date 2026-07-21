# Meeting Provider Architecture

## Overview

Milestone 8.5 adds a centralized meeting-provider layer for interview scheduling. Careeriz remains the source of scheduling workflow and audit history; Google Meet, Zoom, and custom links remain external providers.

## Provider Abstraction

Location: `backend/src/meeting/providers/`

- `baseMeetingProvider.js`
- `googleMeetProvider.js`
- `zoomProvider.js`
- `customMeetingProvider.js`
- `meetingProviderFactory.js`

Supported provider operations:

- `createMeeting`
- `updateMeeting`
- `cancelMeeting`
- `getMeeting`
- `refreshAccessToken`
- `validateConnection`
- `checkAvailability`
- `normalizeProviderError`

## Supported Providers

- `GOOGLE_MEET`
- `ZOOM`
- `CUSTOM`

Future-ready, not implemented:

- Microsoft Teams
- Webex
- Jitsi

## Connection Lifecycle

Organization admins initiate OAuth from admin settings. Provider state is stored as a single-use auth token of type `MEETING_PROVIDER_STATE`. Callback completion persists an encrypted refresh token and sanitized account metadata.

## Storage Model

- `MeetingProviderConnection`
- `InterviewMeeting`
- `MeetingParticipant`
- `InterviewScheduleHistory`

Encrypted values:

- refresh tokens
- access tokens when temporarily persisted
- host URLs where unavoidable

## Failure Handling

- Controllers never call providers directly.
- Scheduling uses service orchestration and safe provider error normalization.
- Provider failures set recoverable meeting state such as `PROVIDER_FAILED`.
- Reminder creation occurs only after successful meeting persistence.

## Security

- organization-scoped connections only
- encrypted token storage using `MEETING_TOKEN_ENCRYPTION_KEY`
- no token serialization
- no raw provider payload exposure
- no secret logging
