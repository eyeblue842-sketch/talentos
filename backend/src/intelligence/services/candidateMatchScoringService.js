import { deterministicMatchVersion } from '../policies/intelligencePolicy.js';

const DEFAULT_PROFILE_KEY = 'default';
const DEFAULT_NORMALIZATION_VERSION = 'match-weight-normalization-v1';
const DEFAULT_PROFILE_RESULT_VERSION = deterministicMatchVersion;

const DEFAULT_WEIGHTS = {
  requiredSkills: { enabled: true, weight: 0.33 },
  preferredSkills: { enabled: true, weight: 0.12 },
  experience: { enabled: true, weight: 0.18 },
  roleTitle: { enabled: true, weight: 0.12 },
  location: { enabled: true, weight: 0.09 },
  workMode: { enabled: true, weight: 0.06 },
  employmentType: { enabled: true, weight: 0.04 },
  noticePeriod: { enabled: true, weight: 0.04 },
  compensation: { enabled: true, weight: 0.02 },
  education: { enabled: false, weight: 0 },
  domain: { enabled: false, weight: 0 },
};

const DEFAULT_THRESHOLDS = {
  recommendation: {
    strongMatch: 85,
    match: 70,
    partialMatch: 55,
  },
  requiredSkillCoverage: {
    knockoutThreshold: 0.4,
  },
};

const DEFAULT_KNOCKOUT_RULES = {
  requiredSkillCoverage: {
    enabled: true,
    minCoverage: 0.4,
  },
  experienceMinimum: {
    enabled: false,
    strict: false,
  },
  workModeMismatch: {
    enabled: false,
    strict: false,
  },
};

const DEFAULT_CONFIDENCE_RULES = {
  unknownCriteriaPenalty: 0.12,
  knockoutPenalty: 0.2,
  minimum: 0.25,
  maximum: 0.95,
};

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueNormalized(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeValue).filter(Boolean))];
}

function tokenizeTitle(value = '') {
  return [...new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];
}

function intersect(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function ratioScore(matches, total, weight = 100) {
  if (!total) return weight;
  return Math.round((matches / total) * weight);
}

function confidenceLabel(score) {
  if (score == null || Number.isNaN(score)) return 'UNKNOWN';
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.55) return 'MEDIUM';
  return 'LOW';
}

function recommendationLabel(score, thresholds, context = {}) {
  if (context.reviewRequired || context.isKnockedOut) return 'REVIEW_REQUIRED';
  if (score >= thresholds.recommendation.strongMatch) return 'STRONG_MATCH';
  if (score >= thresholds.recommendation.match) return 'MATCH';
  if (score >= thresholds.recommendation.partialMatch) return 'PARTIAL_MATCH';
  return 'LIMITED_MATCH';
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeDimensionConfig(value, fallback) {
  const enabled = value?.enabled !== undefined ? Boolean(value.enabled) : Boolean(fallback.enabled);
  const weight = Number(value?.weight ?? fallback.weight);
  if (!Number.isFinite(weight) || weight < 0) {
    const error = new Error('Match scoring weights must be finite positive values.');
    error.code = 'MATCH_SCORING_INVALID_WEIGHT';
    error.retryable = false;
    throw error;
  }
  return { enabled, weight };
}

function normalizeWeights(weights = {}) {
  const merged = {};
  for (const [key, fallback] of Object.entries(DEFAULT_WEIGHTS)) {
    merged[key] = normalizeDimensionConfig(weights[key], fallback);
  }

  const total = Object.values(merged)
    .filter((item) => item.enabled && item.weight > 0)
    .reduce((sum, item) => sum + item.weight, 0);

  if (total <= 0) {
    const error = new Error('At least one scoring dimension must be enabled with a positive weight.');
    error.code = 'MATCH_SCORING_EMPTY_WEIGHTS';
    error.retryable = false;
    throw error;
  }

  for (const key of Object.keys(merged)) {
    merged[key].weight = merged[key].enabled && merged[key].weight > 0
      ? Number((merged[key].weight / total).toFixed(6))
      : 0;
  }
  return merged;
}

function normalizeThresholds(thresholds = {}) {
  const merged = {
    recommendation: {
      strongMatch: Number(thresholds.recommendation?.strongMatch ?? DEFAULT_THRESHOLDS.recommendation.strongMatch),
      match: Number(thresholds.recommendation?.match ?? DEFAULT_THRESHOLDS.recommendation.match),
      partialMatch: Number(thresholds.recommendation?.partialMatch ?? DEFAULT_THRESHOLDS.recommendation.partialMatch),
    },
    requiredSkillCoverage: {
      knockoutThreshold: Number(
        thresholds.requiredSkillCoverage?.knockoutThreshold
        ?? DEFAULT_THRESHOLDS.requiredSkillCoverage.knockoutThreshold
      ),
    },
  };
  if (!(merged.recommendation.strongMatch >= merged.recommendation.match
      && merged.recommendation.match >= merged.recommendation.partialMatch)) {
    const error = new Error('Recommendation thresholds must descend from strong to partial match.');
    error.code = 'MATCH_SCORING_INVALID_THRESHOLDS';
    error.retryable = false;
    throw error;
  }
  return merged;
}

function normalizeKnockoutRules(knockoutRules = {}) {
  return {
    requiredSkillCoverage: {
      enabled: knockoutRules.requiredSkillCoverage?.enabled ?? DEFAULT_KNOCKOUT_RULES.requiredSkillCoverage.enabled,
      minCoverage: Number(knockoutRules.requiredSkillCoverage?.minCoverage ?? DEFAULT_KNOCKOUT_RULES.requiredSkillCoverage.minCoverage),
    },
    experienceMinimum: {
      enabled: knockoutRules.experienceMinimum?.enabled ?? DEFAULT_KNOCKOUT_RULES.experienceMinimum.enabled,
      strict: knockoutRules.experienceMinimum?.strict ?? DEFAULT_KNOCKOUT_RULES.experienceMinimum.strict,
    },
    workModeMismatch: {
      enabled: knockoutRules.workModeMismatch?.enabled ?? DEFAULT_KNOCKOUT_RULES.workModeMismatch.enabled,
      strict: knockoutRules.workModeMismatch?.strict ?? DEFAULT_KNOCKOUT_RULES.workModeMismatch.strict,
    },
  };
}

function normalizeConfidenceRules(confidenceRules = {}) {
  const merged = {
    unknownCriteriaPenalty: Number(confidenceRules.unknownCriteriaPenalty ?? DEFAULT_CONFIDENCE_RULES.unknownCriteriaPenalty),
    knockoutPenalty: Number(confidenceRules.knockoutPenalty ?? DEFAULT_CONFIDENCE_RULES.knockoutPenalty),
    minimum: Number(confidenceRules.minimum ?? DEFAULT_CONFIDENCE_RULES.minimum),
    maximum: Number(confidenceRules.maximum ?? DEFAULT_CONFIDENCE_RULES.maximum),
  };
  return merged;
}

export function getDefaultMatchScoringProfileVersionInput() {
  return {
    key: DEFAULT_PROFILE_KEY,
    name: 'Default Candidate Match Profile',
    description: 'Default deterministic candidate-job scoring profile that preserves the existing Careeriz matching behavior.',
    versionTitle: 'Default v1',
    weightsJson: clone(DEFAULT_WEIGHTS),
    knockoutRulesJson: clone(DEFAULT_KNOCKOUT_RULES),
    thresholdsJson: clone(DEFAULT_THRESHOLDS),
    confidenceRulesJson: clone(DEFAULT_CONFIDENCE_RULES),
    normalizationVersion: DEFAULT_NORMALIZATION_VERSION,
    schemaVersion: '1.0.0',
    promptKey: null,
    promptVersion: null,
    resultVersion: DEFAULT_PROFILE_RESULT_VERSION,
  };
}

export function normalizeMatchScoringProfileVersionInput(input = {}) {
  const defaults = getDefaultMatchScoringProfileVersionInput();
  return {
    weightsJson: normalizeWeights(input.weightsJson || defaults.weightsJson),
    knockoutRulesJson: normalizeKnockoutRules(input.knockoutRulesJson || defaults.knockoutRulesJson),
    thresholdsJson: normalizeThresholds(input.thresholdsJson || defaults.thresholdsJson),
    confidenceRulesJson: normalizeConfidenceRules(input.confidenceRulesJson || defaults.confidenceRulesJson),
    normalizationVersion: input.normalizationVersion || defaults.normalizationVersion,
    schemaVersion: input.schemaVersion || defaults.schemaVersion,
    promptKey: input.promptKey ?? defaults.promptKey,
    promptVersion: input.promptVersion ?? defaults.promptVersion,
    resultVersion: input.resultVersion || defaults.resultVersion,
  };
}

function resolveProfileConfig(profileVersion = null) {
  if (!profileVersion) {
    return normalizeMatchScoringProfileVersionInput(getDefaultMatchScoringProfileVersionInput());
  }
  return normalizeMatchScoringProfileVersionInput(profileVersion);
}

function scoreIfEnabled(config, compute) {
  if (!config.enabled) return null;
  return compute();
}

function weightedScore(score, weight) {
  if (score == null) return 0;
  return score * weight;
}

export function calculateCandidateJobMatchScore(candidate, job, profileVersion = null) {
  const profile = resolveProfileConfig(profileVersion);
  const requiredSkills = uniqueNormalized(job.skillsRequired || []);
  const preferredSkills = uniqueNormalized(job.skillsPreferred || []);
  const candidateSkills = uniqueNormalized(candidate.skills || []);
  const candidateSecondarySkills = uniqueNormalized([
    ...(candidate.functionalSkills || []),
    ...(candidate.tools || []),
    ...(candidate.frameworks || []),
    ...(candidate.cloudPlatforms || []),
    ...(candidate.databases || []),
  ]);

  const matchedRequired = intersect(requiredSkills, candidateSkills);
  const matchedPreferred = intersect(preferredSkills, candidateSkills);
  const missingRequired = requiredSkills.filter((skill) => !matchedRequired.includes(skill));
  const missingPreferred = preferredSkills.filter((skill) => !matchedPreferred.includes(skill));
  const transferable = [...new Set(candidateSecondarySkills.filter((skill) => missingRequired.includes(skill) || missingPreferred.includes(skill)))];

  const requiredCoverage = requiredSkills.length ? (matchedRequired.length / requiredSkills.length) : 1;

  const requiredSkillScore = scoreIfEnabled(profile.weightsJson.requiredSkills, () => ratioScore(matchedRequired.length, requiredSkills.length));
  const preferredSkillScore = scoreIfEnabled(profile.weightsJson.preferredSkills, () => ratioScore(matchedPreferred.length, preferredSkills.length));

  const experienceYears = Number(candidate.totalExperience || 0);
  let experienceScoreBase = 100;
  if (job.experienceMin != null && experienceYears < job.experienceMin) {
    experienceScoreBase = Math.max(0, 100 - ((job.experienceMin - experienceYears) * 25));
  }
  if (job.experienceMax != null && experienceYears > job.experienceMax) {
    experienceScoreBase = Math.max(40, 100 - ((experienceYears - job.experienceMax) * 10));
  }
  const experienceScore = scoreIfEnabled(profile.weightsJson.experience, () => experienceScoreBase);

  const jobTitleTokens = tokenizeTitle(job.title);
  const candidateTitleTokens = tokenizeTitle(candidate.currentTitle || candidate.headline);
  const titleOverlap = intersect(jobTitleTokens, candidateTitleTokens);
  const titleScore = scoreIfEnabled(profile.weightsJson.roleTitle, () => ratioScore(titleOverlap.length, Math.max(jobTitleTokens.length, 1)));

  const candidateLocation = String(candidate.location || '').toLowerCase();
  const jobLocation = String(job.location || '').toLowerCase();
  const locationScore = scoreIfEnabled(profile.weightsJson.location, () => (
    !job.location ? 100 : (candidateLocation && jobLocation && candidateLocation.includes(jobLocation)) ? 100 : 55
  ));

  const workModeScore = scoreIfEnabled(profile.weightsJson.workMode, () => (
    !job.workplaceType
      ? 100
      : Array.isArray(candidate.workplacePreferences) && candidate.workplacePreferences.length
        ? candidate.workplacePreferences.includes(job.workplaceType) ? 100 : 60
        : 70
  ));

  const employmentTypeScore = scoreIfEnabled(profile.weightsJson.employmentType, () => (
    !job.employmentType
      ? 100
      : Array.isArray(candidate.employmentPreferences) && candidate.employmentPreferences.length
        ? candidate.employmentPreferences.includes(job.employmentType) ? 100 : 70
        : 80
  ));

  const noticePeriodDays = candidate.noticePeriodDays ?? null;
  const noticePeriodScore = scoreIfEnabled(profile.weightsJson.noticePeriod, () => (
    noticePeriodDays == null ? 70 : noticePeriodDays <= 30 ? 100 : noticePeriodDays <= 60 ? 75 : 55
  ));

  const compensationScore = scoreIfEnabled(profile.weightsJson.compensation, () => (
    candidate.salaryVisibleToRecruiters && job.salaryMax && candidate.expectedCtcLpa
      ? candidate.expectedCtcLpa <= job.salaryMax ? 100 : 65
      : 70
  ));

  const educationEntries = Array.isArray(candidate.educationEntries) ? candidate.educationEntries : [];
  const educationScore = scoreIfEnabled(profile.weightsJson.education, () => (educationEntries.length ? 70 : 40));

  const overallScore = Math.round(
    weightedScore(requiredSkillScore, profile.weightsJson.requiredSkills.weight)
    + weightedScore(preferredSkillScore, profile.weightsJson.preferredSkills.weight)
    + weightedScore(experienceScore, profile.weightsJson.experience.weight)
    + weightedScore(titleScore, profile.weightsJson.roleTitle.weight)
    + weightedScore(locationScore, profile.weightsJson.location.weight)
    + weightedScore(workModeScore, profile.weightsJson.workMode.weight)
    + weightedScore(employmentTypeScore, profile.weightsJson.employmentType.weight)
    + weightedScore(noticePeriodScore, profile.weightsJson.noticePeriod.weight)
    + weightedScore(compensationScore, profile.weightsJson.compensation.weight)
    + weightedScore(educationScore, profile.weightsJson.education.weight)
  );

  const unknownCriteria = [
    candidate.expectedCtcLpa == null ? 'Expected compensation not shared' : null,
    candidate.noticePeriodDays == null ? 'Notice period not shared' : null,
    !candidate.currentTitle && !candidate.headline ? 'Current title not shared' : null,
    !educationEntries.length ? 'Education details not shared' : null,
  ].filter(Boolean);

  const knockoutResults = [];
  if (profile.knockoutRulesJson.requiredSkillCoverage.enabled && requiredCoverage < profile.knockoutRulesJson.requiredSkillCoverage.minCoverage) {
    knockoutResults.push({
      ruleKey: 'required_skill_coverage',
      triggered: true,
      reason: `Required skill coverage ${requiredCoverage.toFixed(2)} is below the minimum threshold ${profile.knockoutRulesJson.requiredSkillCoverage.minCoverage.toFixed(2)}.`,
      evidenceKeys: ['requiredSkills'],
      profileVersion: profile.resultVersion,
    });
  }
  if (profile.knockoutRulesJson.experienceMinimum.enabled && job.experienceMin != null && experienceYears < job.experienceMin) {
    knockoutResults.push({
      ruleKey: 'minimum_experience',
      triggered: true,
      reason: `Candidate experience ${experienceYears} is below the required minimum ${job.experienceMin}.`,
      evidenceKeys: ['experience'],
      profileVersion: profile.resultVersion,
    });
  }
  if (profile.knockoutRulesJson.workModeMismatch.enabled && job.workplaceType && Array.isArray(candidate.workplacePreferences) && candidate.workplacePreferences.length && !candidate.workplacePreferences.includes(job.workplaceType)) {
    knockoutResults.push({
      ruleKey: 'work_mode_mismatch',
      triggered: true,
      reason: `Candidate work mode preferences do not include the job work mode ${job.workplaceType}.`,
      evidenceKeys: ['workMode'],
      profileVersion: profile.resultVersion,
    });
  }

  const isKnockedOut = knockoutResults.some((item) => item.triggered);
  const reviewRequired = !candidate.fullName || (!candidate.email && !candidate.phoneNumber && !candidate.linkedInUrlNormalized);
  const confidenceScore = Math.max(
    profile.confidenceRulesJson.minimum,
    Math.min(
      profile.confidenceRulesJson.maximum,
      1 - (unknownCriteria.length * profile.confidenceRulesJson.unknownCriteriaPenalty) - (isKnockedOut ? profile.confidenceRulesJson.knockoutPenalty : 0),
    ),
  );

  return {
    scoreVersion: profile.resultVersion,
    scoringProfile: profile,
    overallScore,
    confidence: {
      score: Number(confidenceScore.toFixed(2)),
      label: confidenceLabel(confidenceScore),
    },
    recommendation: {
      label: recommendationLabel(overallScore, profile.thresholdsJson, { reviewRequired, isKnockedOut }),
      reviewRequired,
    },
    subscores: {
      requiredSkills: requiredSkillScore,
      preferredSkills: preferredSkillScore,
      experience: experienceScore,
      roleTitle: titleScore,
      location: locationScore,
      workMode: workModeScore,
      employmentType: employmentTypeScore,
      noticePeriod: noticePeriodScore,
      compensation: compensationScore,
      education: educationScore,
      domain: null,
    },
    weights: profile.weightsJson,
    matchedSkills: {
      required: matchedRequired,
      preferred: matchedPreferred,
      transferable,
    },
    missingSkills: {
      required: missingRequired,
      preferred: missingPreferred,
    },
    unknownCriteria,
    knockoutResults,
    isKnockedOut,
    explanation: [
      matchedRequired.length ? `${matchedRequired.length}/${requiredSkills.length || matchedRequired.length} required skills matched.` : 'No required skill overlap identified yet.',
      experienceScoreBase >= 90 ? 'Experience aligns well with the role range.' : 'Experience is partially aligned with the role range.',
      locationScore == null || locationScore >= 90 ? 'Location is compatible with the requirement.' : 'Location compatibility is partial or unknown.',
      isKnockedOut ? 'One or more deterministic knockout rules were triggered.' : null,
    ].filter(Boolean).join(' '),
  };
}
