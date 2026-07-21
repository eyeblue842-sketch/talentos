export class BaseMeetingProvider {
  constructor({ connection = null } = {}) {
    this.connection = connection;
  }

  async createMeeting() {
    throw new Error('createMeeting must be implemented by the provider.');
  }

  async updateMeeting() {
    throw new Error('updateMeeting must be implemented by the provider.');
  }

  async cancelMeeting() {
    throw new Error('cancelMeeting must be implemented by the provider.');
  }

  async getMeeting() {
    throw new Error('getMeeting must be implemented by the provider.');
  }

  async refreshAccessToken() {
    throw new Error('refreshAccessToken must be implemented by the provider.');
  }

  async validateConnection() {
    throw new Error('validateConnection must be implemented by the provider.');
  }

  async checkAvailability() {
    return {
      providerChecked: false,
      participants: [],
      suggestions: [],
    };
  }
}
