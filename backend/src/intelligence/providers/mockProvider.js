function buildJobDescriptionOutput() {
  return {
    summary: 'Senior backend engineering role focused on cloud-native service development and operational ownership.',
    responsibilities: [
      'Design and deliver backend services for production applications.',
      'Collaborate with cross-functional teams to ship reliable features.',
    ],
    requiredSkills: ['Java', 'Spring Boot', 'AWS'],
    preferredSkills: ['Docker', 'Kafka'],
    screeningQuestions: [
      'Describe a backend service you designed and operated in production.',
    ],
    assumptions: [],
    exclusionaryWordingWarnings: [],
    missingFields: [],
    interviewFocus: ['Validate Spring Boot depth with practical production examples.'],
  };
}

function buildCandidateIntelligenceOutput() {
  return {
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
  };
}

export const mockProvider = {
  provider: 'MOCK',
  async healthCheck() {
    return {
      provider: 'MOCK',
      healthy: true,
      reason: null,
    };
  },
  async generate({ prompt }) {
    const normalizedPrompt = String(prompt || '').toLowerCase();
    const isCandidateIntelligenceSchema = normalizedPrompt.includes('candidate insights')
      || normalizedPrompt.includes('professional evidence catalog')
      || normalizedPrompt.includes('evidenceids');
    const text = isCandidateIntelligenceSchema
      ? JSON.stringify(buildCandidateIntelligenceOutput())
      : JSON.stringify(buildJobDescriptionOutput());

    return {
      text,
      model: 'careeriz-mock-provider',
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 1,
    };
  },
};
