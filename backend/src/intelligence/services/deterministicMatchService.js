import { deterministicMatchVersion } from '../policies/intelligencePolicy.js';

function normalizeSkill(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueSkills(values = []) {
  return [...new Set(values.map(normalizeSkill).filter(Boolean))];
}

function intersect(a = [], b = []) {
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item));
}

function ratioScore(matches, total, weight = 100) {
  if (!total) return weight;
  return Math.round((matches / total) * weight);
}

function tokenizeTitle(value = '') {
  return [...new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];
}

export function calculateDeterministicCandidateMatch(candidate, job) {
  const requiredSkills = uniqueSkills(job.skillsRequired || []);
  const preferredSkills = uniqueSkills(job.skillsPreferred || []);
  const candidateSkills = uniqueSkills(candidate.skills || []);
  const matchedRequired = intersect(requiredSkills, candidateSkills);
  const matchedPreferred = intersect(preferredSkills, candidateSkills);
  const missingRequired = requiredSkills.filter((skill) => !matchedRequired.includes(skill));
  const missingPreferred = preferredSkills.filter((skill) => !matchedPreferred.includes(skill));

  const requiredSkillScore = ratioScore(matchedRequired.length, requiredSkills.length);
  const preferredSkillScore = ratioScore(matchedPreferred.length, preferredSkills.length);

  const experienceYears = Number(candidate.totalExperience || 0);
  let experienceScore = 100;
  if (job.experienceMin != null && experienceYears < job.experienceMin) {
    experienceScore = Math.max(0, 100 - ((job.experienceMin - experienceYears) * 25));
  }
  if (job.experienceMax != null && experienceYears > job.experienceMax) {
    experienceScore = Math.max(40, 100 - ((experienceYears - job.experienceMax) * 10));
  }

  const jobTitleTokens = tokenizeTitle(job.title);
  const candidateTitleTokens = tokenizeTitle(candidate.currentTitle || candidate.headline);
  const titleOverlap = intersect(jobTitleTokens, candidateTitleTokens);
  const titleScore = ratioScore(titleOverlap.length, Math.max(jobTitleTokens.length, 1));

  const candidateLocation = String(candidate.location || '').toLowerCase();
  const jobLocation = String(job.location || '').toLowerCase();
  const locationScore = !job.location
    ? 100
    : (candidateLocation && jobLocation && candidateLocation.includes(jobLocation)) ? 100 : 55;

  const workModeScore = !job.workplaceType
    ? 100
    : Array.isArray(candidate.workplacePreferences) && candidate.workplacePreferences.length
      ? candidate.workplacePreferences.includes(job.workplaceType) ? 100 : 60
      : 70;

  const employmentTypeScore = !job.employmentType
    ? 100
    : Array.isArray(candidate.employmentPreferences) && candidate.employmentPreferences.length
      ? candidate.employmentPreferences.includes(job.employmentType) ? 100 : 70
      : 80;

  const noticePeriodDays = candidate.noticePeriodDays ?? null;
  const noticePeriodScore = noticePeriodDays == null
    ? 70
    : noticePeriodDays <= 30 ? 100 : noticePeriodDays <= 60 ? 75 : 55;

  const compensationScore = candidate.salaryVisibleToRecruiters && job.salaryMax && candidate.expectedCtcLpa
    ? candidate.expectedCtcLpa <= job.salaryMax ? 100 : 65
    : 70;

  const weightedOverall = Math.round(
    (requiredSkillScore * 0.33)
    + (preferredSkillScore * 0.12)
    + (experienceScore * 0.18)
    + (titleScore * 0.12)
    + (locationScore * 0.09)
    + (workModeScore * 0.06)
    + (employmentTypeScore * 0.04)
    + (noticePeriodScore * 0.04)
    + (compensationScore * 0.02)
  );

  return {
    scoreVersion: deterministicMatchVersion,
    overallScore: weightedOverall,
    subscores: {
      requiredSkillScore,
      preferredSkillScore,
      experienceScore,
      titleScore,
      locationScore,
      workModeScore,
      employmentTypeScore,
      noticePeriodScore,
      compensationScore,
    },
    matchedCriteria: matchedRequired.map((item) => item.toUpperCase()),
    missingRequiredCriteria: missingRequired.map((item) => item.toUpperCase()),
    missingPreferredCriteria: missingPreferred.map((item) => item.toUpperCase()),
    unknownCriteria: [
      candidate.expectedCtcLpa == null ? 'Expected compensation not shared' : null,
      candidate.noticePeriodDays == null ? 'Notice period not shared' : null,
      !candidate.currentTitle && !candidate.headline ? 'Current title not shared' : null,
    ].filter(Boolean),
    explanation: [
      matchedRequired.length ? `${matchedRequired.length}/${requiredSkills.length || matchedRequired.length} required skills matched.` : 'No required skill overlap identified yet.',
      experienceScore >= 90 ? 'Experience aligns well with the role range.' : 'Experience is partially aligned with the role range.',
      locationScore >= 90 ? 'Location is compatible with the requirement.' : 'Location compatibility is partial or unknown.',
    ].join(' '),
  };
}
