const envFlagMap = {
  bulkResumeImport: 'NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT',
  aiResumeParsing: 'NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING',
  candidateIntelligence: 'NEXT_PUBLIC_FEATURE_CANDIDATE_INTELLIGENCE',
  aiJobDescription: 'NEXT_PUBLIC_FEATURE_AI_JOB_DESCRIPTION',
  candidateMatching: 'NEXT_PUBLIC_FEATURE_CANDIDATE_MATCHING',
  candidateRanking: 'NEXT_PUBLIC_FEATURE_CANDIDATE_RANKING',
  matchOverrides: 'NEXT_PUBLIC_FEATURE_MATCH_OVERRIDES',
  matchScoringProfiles: 'NEXT_PUBLIC_FEATURE_MATCH_SCORING_PROFILES',
  semanticSearch: 'NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH',
  semanticSearchExpansion: 'NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH_EXPANSION',
  savedSearches: 'NEXT_PUBLIC_FEATURE_SAVED_SEARCHES',
  searchHistory: 'NEXT_PUBLIC_FEATURE_SEARCH_HISTORY',
  searchSuggestions: 'NEXT_PUBLIC_FEATURE_SEARCH_SUGGESTIONS',
  similarCandidateSearch: 'NEXT_PUBLIC_FEATURE_SIMILAR_CANDIDATE_SEARCH',
  similarJobSearch: 'NEXT_PUBLIC_FEATURE_SIMILAR_JOB_SEARCH',
  resumeSearchV2: 'NEXT_PUBLIC_FEATURE_RESUME_SEARCH_V2',
};

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

export function getFeatureFlags() {
  return {
    bulkResumeImport: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT, false),
    aiResumeParsing: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING, false),
    candidateIntelligence: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_CANDIDATE_INTELLIGENCE, false),
    aiJobDescription: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_AI_JOB_DESCRIPTION, false),
    candidateMatching: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_CANDIDATE_MATCHING, false),
    candidateRanking: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_CANDIDATE_RANKING, false),
    matchOverrides: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_MATCH_OVERRIDES, false),
    matchScoringProfiles: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_MATCH_SCORING_PROFILES, false),
    semanticSearch: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH, false),
    semanticSearchExpansion: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH_EXPANSION, false),
    savedSearches: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SAVED_SEARCHES, false),
    searchHistory: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SEARCH_HISTORY, false),
    searchSuggestions: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SEARCH_SUGGESTIONS, false),
    similarCandidateSearch: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SIMILAR_CANDIDATE_SEARCH, false),
    similarJobSearch: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_SIMILAR_JOB_SEARCH, false),
    resumeSearchV2: normalizeBoolean(process.env.NEXT_PUBLIC_FEATURE_RESUME_SEARCH_V2, false),
  };
}

export function isFeatureEnabled(featureKey) {
  const flags = getFeatureFlags();
  return Boolean(flags[featureKey]);
}

export function getFeatureFlagEnvName(featureKey) {
  return envFlagMap[featureKey] || null;
}
