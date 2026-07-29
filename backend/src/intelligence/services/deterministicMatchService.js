import { calculateCandidateJobMatchScore } from './candidateMatchScoringService.js';

export function calculateDeterministicCandidateMatch(candidate, job) {
  const score = calculateCandidateJobMatchScore(candidate, job);
  return {
    scoreVersion: score.scoreVersion,
    overallScore: score.overallScore,
    subscores: {
      requiredSkillScore: score.subscores.requiredSkills,
      preferredSkillScore: score.subscores.preferredSkills,
      experienceScore: score.subscores.experience,
      titleScore: score.subscores.roleTitle,
      locationScore: score.subscores.location,
      workModeScore: score.subscores.workMode,
      employmentTypeScore: score.subscores.employmentType,
      noticePeriodScore: score.subscores.noticePeriod,
      compensationScore: score.subscores.compensation,
    },
    matchedCriteria: score.matchedSkills.required.map((item) => item.toUpperCase()),
    missingRequiredCriteria: score.missingSkills.required.map((item) => item.toUpperCase()),
    missingPreferredCriteria: score.missingSkills.preferred.map((item) => item.toUpperCase()),
    unknownCriteria: score.unknownCriteria,
    explanation: score.explanation,
  };
}
