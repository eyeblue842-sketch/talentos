export const disabledProvider = {
  provider: 'DISABLED',
  async healthCheck() {
    return {
      provider: 'DISABLED',
      healthy: false,
      reason: 'Intelligence provider is disabled.',
    };
  },
  async generate() {
    const error = new Error('Intelligence provider is disabled.');
    error.code = 'INTELLIGENCE_DISABLED';
    error.statusCode = 503;
    throw error;
  },
};
