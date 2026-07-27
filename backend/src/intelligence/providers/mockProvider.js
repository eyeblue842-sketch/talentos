export const mockProvider = {
  provider: 'MOCK',
  async healthCheck() {
    return {
      provider: 'MOCK',
      healthy: true,
      reason: null,
    };
  },
  async generate() {
    return {
      text: JSON.stringify({
        professionalSummary: {
          text: 'Structured candidate intelligence mock summary based on the supplied professional profile.',
          confidence: 0.72,
          evidenceIds: ['ev_profile_title'],
        },
        roleThemes: [
          {
            text: 'Role history indicates alignment with software engineering delivery.',
            confidence: 0.69,
            evidenceIds: ['ev_experience_recent'],
          },
        ],
        strengths: [
          {
            text: 'Demonstrates explicit technical skill coverage in the submitted profile.',
            confidence: 0.74,
            evidenceIds: ['ev_skills_explicit'],
          },
        ],
        developmentAreas: [
          {
            text: 'Structured education or certification detail is limited and should be reviewed.',
            confidence: 0.61,
            evidenceIds: ['ev_data_gap_education'],
          },
        ],
        recommendedRoles: [
          {
            role: 'Software Engineer',
            rationale: 'Recommended because the structured title and skill evidence align with software engineering work.',
            confidence: 0.71,
            evidenceIds: ['ev_profile_title', 'ev_skills_explicit'],
          },
        ],
        keywordClusters: [
          {
            text: 'Software engineering, application delivery, technical implementation',
            confidence: 0.66,
            evidenceIds: ['ev_skills_explicit'],
          },
        ],
        warnings: [],
      }),
      model: 'careeriz-mock-provider',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 1,
    };
  },
};
