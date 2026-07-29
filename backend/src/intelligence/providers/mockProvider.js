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

function buildCandidateJobMatchOutput() {
  return {
    recruiterSummary: {
      text: 'The candidate aligns with the role on core backend engineering skills and relevant delivery experience, with a few areas that still need recruiter validation.',
      confidence: 0.73,
      evidenceIds: ['ev_required_skills', 'ev_experience', 'ev_title_alignment'],
    },
    strengths: [
      {
        text: 'Core required backend skills are explicitly present in the candidate profile.',
        confidence: 0.78,
        evidenceIds: ['ev_required_skills'],
      },
    ],
    risks: [
      {
        text: 'Compensation or notice-period information may still require manual confirmation.',
        confidence: 0.62,
        evidenceIds: ['ev_notice_period', 'ev_compensation'],
      },
    ],
    interviewFocus: [
      {
        text: 'Validate recent ownership of production backend services and depth in the required stack.',
        confidence: 0.69,
        evidenceIds: ['ev_required_skills', 'ev_title_alignment'],
      },
    ],
    recommendation: {
      label: 'MATCH',
      reason: 'The deterministic score and supporting evidence indicate credible alignment for recruiter review.',
      confidence: 0.71,
      evidenceIds: ['ev_required_skills', 'ev_experience', 'ev_title_alignment'],
    },
    transferableSkills: [],
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
    const isCandidateMatchSchema = normalizedPrompt.includes('candidate-job match insights')
      || normalizedPrompt.includes('deterministic score')
      || normalizedPrompt.includes('recommendation labels must be one of strong_match');
    const isCandidateIntelligenceSchema = normalizedPrompt.includes('candidate insights')
      || normalizedPrompt.includes('professional evidence catalog')
      || normalizedPrompt.includes('evidenceids');
    const text = isCandidateMatchSchema
      ? JSON.stringify(buildCandidateJobMatchOutput())
      : isCandidateIntelligenceSchema
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
