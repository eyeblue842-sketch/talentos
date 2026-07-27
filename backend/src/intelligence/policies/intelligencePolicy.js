export const intelligenceFeatureConfig = {
  RESUME_SUMMARY: {
    flag: 'intelligence.resume_summary',
    permissionRead: 'intelligence.resume.read',
    permissionGenerate: 'intelligence.resume.generate',
    ttlHours: 72,
  },
  RESUME_SKILL_EXTRACTION: {
    flag: 'intelligence.skill_extraction',
    permissionRead: 'intelligence.resume.read',
    permissionGenerate: 'intelligence.resume.generate',
    ttlHours: 72,
  },
  CANDIDATE_MATCH: {
    flag: 'intelligence.candidate_matching',
    permissionRead: 'intelligence.match.read',
    permissionGenerate: 'intelligence.match.generate',
    ttlHours: 24,
  },
  CANDIDATE_INTELLIGENCE: {
    flag: 'intelligence.candidate_intelligence',
    permissionRead: 'intelligence.candidate.read',
    permissionGenerate: 'intelligence.candidate.generate',
    ttlHours: 72,
  },
  JOB_DESCRIPTION: {
    flag: 'intelligence.job_description',
    permissionRead: 'intelligence.job.generate',
    permissionGenerate: 'intelligence.job.generate',
    ttlHours: 24,
  },
  INTERVIEW_ASSISTANT: {
    flag: 'intelligence.interview_assistant',
    permissionRead: 'intelligence.interview.generate',
    permissionGenerate: 'intelligence.interview.generate',
    ttlHours: 24,
  },
  TALENT_SEARCH: {
    flag: 'intelligence.talent_search',
    permissionRead: 'intelligence.search.use',
    permissionGenerate: 'intelligence.search.use',
    ttlHours: 12,
  },
  ANALYTICS_INSIGHT: {
    flag: 'intelligence.analytics_insights',
    permissionRead: 'intelligence.analytics.use',
    permissionGenerate: 'intelligence.analytics.use',
    ttlHours: 12,
  },
};

export const intelligenceUsageLimits = {
  defaultPerUserPerDay: 50,
  defaultPerOrganisationPerDay: 300,
  maxBatchSize: 25,
  maxInputCharacters: 30000,
  featureOverrides: {
    ANALYTICS_INSIGHT: { perUserPerDay: 20, perOrganisationPerDay: 120 },
    JOB_DESCRIPTION: { perUserPerDay: 25, perOrganisationPerDay: 120 },
    TALENT_SEARCH: { perUserPerDay: 80, perOrganisationPerDay: 400 },
  },
};

export const deterministicMatchVersion = 'careeriz-match-v1';
export const analyticsMetricVersion = 'careeriz-analytics-v1';

export const prohibitedIntelligenceTopics = [
  'race',
  'religion',
  'caste',
  'ethnicity',
  'gender',
  'health',
  'disability',
  'pregnancy',
  'sexual orientation',
  'political belief',
  'culture fit',
  'personality',
  'family background',
  'loyalty prediction',
  'emotion inference',
  'truthfulness inference',
];

export const dataClasses = {
  PUBLIC_JOB_DATA: 'PUBLIC_JOB_DATA',
  ORGANIZATION_INTERNAL: 'ORGANIZATION_INTERNAL',
  CANDIDATE_PROFESSIONAL: 'CANDIDATE_PROFESSIONAL',
  CANDIDATE_CONTACT: 'CANDIDATE_CONTACT',
  HIGHLY_SENSITIVE: 'HIGHLY_SENSITIVE',
  PROHIBITED_FOR_AI: 'PROHIBITED_FOR_AI',
};
