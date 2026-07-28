const envFlagMap = {
  bulkResumeImport: 'NEXT_PUBLIC_FEATURE_BULK_RESUME_IMPORT',
  aiResumeParsing: 'NEXT_PUBLIC_FEATURE_AI_RESUME_PARSING',
  candidateIntelligence: 'NEXT_PUBLIC_FEATURE_CANDIDATE_INTELLIGENCE',
  aiJobDescription: 'NEXT_PUBLIC_FEATURE_AI_JOB_DESCRIPTION',
};

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
  };
}

export function isFeatureEnabled(featureKey) {
  const flags = getFeatureFlags();
  return Boolean(flags[featureKey]);
}

export function getFeatureFlagEnvName(featureKey) {
  return envFlagMap[featureKey] || null;
}
