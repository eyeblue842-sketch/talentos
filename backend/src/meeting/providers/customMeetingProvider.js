import { BaseMeetingProvider } from './baseMeetingProvider.js';
import { ensureHttpsUrl, sanitizeMeetingText } from '../meetingValidation.js';

export class CustomMeetingProvider extends BaseMeetingProvider {
  async createMeeting({ meetingInput }) {
    return {
      provider: 'CUSTOM',
      externalMeetingId: null,
      externalCalendarEventId: null,
      conferenceId: null,
      safeJoinUrl: meetingInput.meetingMode === 'VIRTUAL'
        ? ensureHttpsUrl(meetingInput.safeJoinUrl || meetingInput.meetingLink)
        : null,
      encryptedHostUrl: null,
      passcodeMetadata: meetingInput.passcode ? { passcodeSet: true } : null,
      providerMetadata: {
        providerDisplayName: sanitizeMeetingText(meetingInput.providerDisplayName || 'Custom'),
        dialInInformation: sanitizeMeetingText(meetingInput.dialInInformation, 1000),
      },
    };
  }

  async updateMeeting({ meetingInput }) {
    return this.createMeeting({ meetingInput });
  }

  async cancelMeeting() {
    return { cancelled: true };
  }

  async validateConnection() {
    return {
      status: 'CONNECTED',
      connectedEmail: null,
      connectedAccountId: 'custom-manual-link',
      scopes: [],
    };
  }
}
