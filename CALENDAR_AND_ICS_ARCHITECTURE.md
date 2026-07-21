# Calendar and ICS Architecture

## Calendar Strategy

Careeriz stores canonical schedule data in UTC and renders it in user or organization timezones.

## ICS Generation

ICS generation is centralized in `backend/src/meeting/calendarService.js`.

Supported output:

- `METHOD:REQUEST`
- `METHOD:CANCEL`
- stable UID
- sequence increments
- UTC timestamps
- organizer and attendee metadata
- safe description and location fields

## Compatibility Goal

Generated ICS is intended to work with:

- Google Calendar
- Microsoft Outlook
- Apple Calendar

## Access Control

Calendar download endpoints are permission-checked for:

- recruiter/authorized organization user
- candidate owning the interview

Unauthorized access is rejected server-side.
