import { env } from '../../config/env.js';
import { BaseMeetingProvider } from './baseMeetingProvider.js';
import { normalizeProviderError } from '../meetingValidation.js';

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || 'Google provider request failed.');
    error.statusCode = response.status;
    error.code = 'GOOGLE_PROVIDER_ERROR';
    throw error;
  }
  return response.json();
}

export class GoogleMeetProvider extends BaseMeetingProvider {
  async createMeeting({ accessToken, meetingInput, attendees, externalId }) {
    try {
      const calendarId = this.connection?.calendarId || 'primary';
      const payload = {
        summary: meetingInput.title,
        description: meetingInput.candidateDescription,
        location: meetingInput.location || undefined,
        start: {
          dateTime: meetingInput.scheduledStartUtc.toISOString(),
          timeZone: meetingInput.timezone,
        },
        end: {
          dateTime: meetingInput.scheduledEndUtc.toISOString(),
          timeZone: meetingInput.timezone,
        },
        attendees: attendees.map((item) => ({ email: item.email })),
        conferenceData: {
          createRequest: {
            requestId: externalId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      };

      const event = await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return {
        provider: 'GOOGLE_MEET',
        externalMeetingId: event.id || null,
        externalCalendarEventId: event.id || null,
        conferenceId: event.conferenceData?.conferenceId || null,
        safeJoinUrl: event.conferenceData?.entryPoints?.find((item) => item.entryPointType === 'video')?.uri || event.hangoutLink || null,
        encryptedHostUrl: null,
        passcodeMetadata: null,
        providerMetadata: {
          htmlLink: event.htmlLink || null,
          eventStatus: event.status || null,
          organizerEmail: event.organizer?.email || null,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }

  async updateMeeting({ accessToken, meeting, meetingInput, attendees }) {
    try {
      const calendarId = this.connection?.calendarId || 'primary';
      const payload = {
        summary: meetingInput.title,
        description: meetingInput.candidateDescription,
        location: meetingInput.location || undefined,
        start: {
          dateTime: meetingInput.scheduledStartUtc.toISOString(),
          timeZone: meetingInput.timezone,
        },
        end: {
          dateTime: meetingInput.scheduledEndUtc.toISOString(),
          timeZone: meetingInput.timezone,
        },
        attendees: attendees.map((item) => ({ email: item.email })),
      };

      const event = await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(meeting.externalCalendarEventId)}?sendUpdates=all&conferenceDataVersion=1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return {
        provider: 'GOOGLE_MEET',
        externalMeetingId: event.id || meeting.externalMeetingId || null,
        externalCalendarEventId: event.id || meeting.externalCalendarEventId || null,
        conferenceId: event.conferenceData?.conferenceId || meeting.conferenceId || null,
        safeJoinUrl: event.conferenceData?.entryPoints?.find((item) => item.entryPointType === 'video')?.uri || event.hangoutLink || meeting.safeJoinUrl || null,
        encryptedHostUrl: null,
        passcodeMetadata: null,
        providerMetadata: {
          htmlLink: event.htmlLink || null,
          eventStatus: event.status || null,
          organizerEmail: event.organizer?.email || null,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }

  async cancelMeeting({ accessToken, meeting }) {
    try {
      const calendarId = this.connection?.calendarId || 'primary';
      await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(meeting.externalCalendarEventId)}?sendUpdates=all`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return { cancelled: true };
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }

  async validateConnection({ accessToken }) {
    try {
      const response = await fetchJson('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return {
        status: 'CONNECTED',
        connectedEmail: response.email || null,
        connectedAccountId: response.id || null,
        scopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
      };
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }

  async refreshAccessToken({ refreshToken }) {
    try {
      const body = new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });
      return fetchJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }

  async checkAvailability({ accessToken, attendees, startUtc, endUtc }) {
    try {
      const calendarId = this.connection?.calendarId || 'primary';
      const response = await fetchJson('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: startUtc.toISOString(),
          timeMax: endUtc.toISOString(),
          items: [{ id: calendarId }, ...attendees.map((item) => ({ id: item.email }))],
        }),
      });

      return {
        providerChecked: true,
        participants: attendees.map((attendee) => ({
          email: attendee.email,
          busy: Boolean(response.calendars?.[attendee.email]?.busy?.length),
        })),
        suggestions: [],
      };
    } catch (error) {
      throw normalizeProviderError(error, 'GOOGLE_MEET');
    }
  }
}
