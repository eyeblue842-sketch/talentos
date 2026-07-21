import { env } from '../../config/env.js';
import { BaseMeetingProvider } from './baseMeetingProvider.js';
import { normalizeProviderError } from '../meetingValidation.js';

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || 'Zoom provider request failed.');
    error.statusCode = response.status;
    error.code = 'ZOOM_PROVIDER_ERROR';
    throw error;
  }
  if (response.status === 204) return {};
  return response.json();
}

export class ZoomProvider extends BaseMeetingProvider {
  async createMeeting({ accessToken, meetingInput, attendees }) {
    try {
      const payload = {
        topic: meetingInput.title,
        type: 2,
        start_time: meetingInput.scheduledStartUtc.toISOString(),
        duration: meetingInput.durationMinutes,
        timezone: meetingInput.timezone,
        agenda: meetingInput.candidateDescription || undefined,
        settings: {
          waiting_room: Boolean(meetingInput.waitingRoomEnabled),
          join_before_host: false,
          participant_video: true,
          host_video: true,
        },
      };

      const meeting = await fetchJson('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return {
        provider: 'ZOOM',
        externalMeetingId: meeting.id ? String(meeting.id) : null,
        externalCalendarEventId: null,
        conferenceId: meeting.uuid || null,
        safeJoinUrl: meeting.join_url || null,
        encryptedHostUrl: meeting.start_url || null,
        passcodeMetadata: meeting.password ? { passcodeSet: true } : null,
        providerMetadata: {
          hostEmail: meeting.host_email || null,
          settings: meeting.settings || null,
          attendeeEmails: attendees.map((item) => item.email),
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, 'ZOOM');
    }
  }

  async updateMeeting({ accessToken, meeting, meetingInput }) {
    try {
      const payload = {
        topic: meetingInput.title,
        start_time: meetingInput.scheduledStartUtc.toISOString(),
        duration: meetingInput.durationMinutes,
        timezone: meetingInput.timezone,
        agenda: meetingInput.candidateDescription || undefined,
        settings: {
          waiting_room: Boolean(meetingInput.waitingRoomEnabled),
          join_before_host: false,
          participant_video: true,
          host_video: true,
        },
      };

      await fetchJson(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meeting.externalMeetingId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const refreshed = await fetchJson(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meeting.externalMeetingId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        provider: 'ZOOM',
        externalMeetingId: refreshed.id ? String(refreshed.id) : meeting.externalMeetingId,
        externalCalendarEventId: null,
        conferenceId: refreshed.uuid || meeting.conferenceId || null,
        safeJoinUrl: refreshed.join_url || meeting.safeJoinUrl || null,
        encryptedHostUrl: refreshed.start_url || null,
        passcodeMetadata: refreshed.password ? { passcodeSet: true } : null,
        providerMetadata: {
          hostEmail: refreshed.host_email || null,
          settings: refreshed.settings || null,
        },
      };
    } catch (error) {
      throw normalizeProviderError(error, 'ZOOM');
    }
  }

  async cancelMeeting({ accessToken, meeting }) {
    try {
      await fetchJson(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meeting.externalMeetingId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return { cancelled: true };
    } catch (error) {
      throw normalizeProviderError(error, 'ZOOM');
    }
  }

  async validateConnection({ accessToken }) {
    try {
      const user = await fetchJson('https://api.zoom.us/v2/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        status: 'CONNECTED',
        connectedEmail: user.email || null,
        connectedAccountId: user.account_id || user.id || null,
        scopes: [],
      };
    } catch (error) {
      throw normalizeProviderError(error, 'ZOOM');
    }
  }

  async refreshAccessToken({ refreshToken }) {
    try {
      const credentials = Buffer.from(`${env.zoomClientId}:${env.zoomClientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      return fetchJson('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (error) {
      throw normalizeProviderError(error, 'ZOOM');
    }
  }
}
