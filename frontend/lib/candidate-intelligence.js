import {
  candidateIntelligenceResponseSchema,
  candidateIntelligenceStatusResponseSchema,
} from '@careeriz/shared';

export const CANDIDATE_INTELLIGENCE_TERMINAL_STATUSES = new Set([
  'READY',
  'FAILED',
  'DISABLED',
  'REVIEW_REQUIRED',
]);

const statusMeta = {
  READY: {
    label: 'Insights ready',
    tone: 'success',
    description: 'Structured and AI-supported recruiter insights are available.',
  },
  STALE: {
    label: 'Candidate information changed',
    tone: 'warning',
    description: 'Candidate or resume information changed after these insights were generated.',
  },
  PENDING: {
    label: 'Generating insights',
    tone: 'info',
    description: 'A background generation task is currently running.',
  },
  FAILED: {
    label: 'Generation failed',
    tone: 'danger',
    description: 'The last generation attempt did not complete successfully.',
  },
  DISABLED: {
    label: 'AI generation unavailable',
    tone: 'neutral',
    description: 'AI generation is disabled, but deterministic profile signals are still available.',
  },
  REVIEW_REQUIRED: {
    label: 'Limited source information',
    tone: 'warning',
    description: 'The candidate profile needs more structured source data for richer insights.',
  },
};

const confidenceToneByLabel = {
  HIGH: 'success',
  MEDIUM: 'info',
  LOW: 'warning',
  UNKNOWN: 'neutral',
};

const qualityToneByLabel = {
  HIGH: 'success',
  MEDIUM: 'info',
  LOW: 'warning',
  UNKNOWN: 'neutral',
};

const skillCategoryRules = [
  ['Programming Languages', ['javascript', 'typescript', 'java', 'python', 'golang', 'go', 'c#', 'ruby', 'php']],
  ['Frontend', ['react', 'next.js', 'angular', 'vue', 'html', 'css', 'tailwind']],
  ['Backend', ['node.js', 'spring boot', 'express', 'django', 'flask', 'nestjs', 'laravel']],
  ['Frameworks', ['spring boot', 'react', 'next.js', 'django', 'flask', 'nestjs']],
  ['Cloud', ['aws', 'azure', 'gcp', 'google cloud']],
  ['Databases', ['postgresql', 'mysql', 'mongodb', 'redis', 'oracle', 'sql server']],
  ['DevOps', ['docker', 'kubernetes', 'terraform', 'jenkins', 'github actions']],
  ['Testing', ['jest', 'vitest', 'cypress', 'playwright', 'selenium', 'junit']],
  ['Messaging', ['kafka', 'rabbitmq', 'sqs', 'sns']],
  ['Tools', ['figma', 'jira', 'confluence', 'postman', 'git']],
  ['Methodologies', ['agile', 'scrum', 'kanban']],
  ['Soft Skills', ['mentoring', 'communication', 'leadership', 'stakeholder management']],
];

export function parseCandidateIntelligenceResponse(payload) {
  return candidateIntelligenceResponseSchema.parse(payload);
}

export function parseCandidateIntelligenceStatusResponse(payload) {
  return candidateIntelligenceStatusResponseSchema.parse(payload);
}

export function getCandidateIntelligenceStatusMeta(status) {
  return statusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized intelligence status: ${status}` : 'Candidate intelligence status is unavailable.',
  };
}

export function getConfidenceMeta(confidence) {
  const label = confidence?.label || 'UNKNOWN';
  return {
    label,
    tone: confidenceToneByLabel[label] || 'neutral',
    score: typeof confidence?.score === 'number' ? confidence.score : null,
  };
}

export function getQualityMeta(quality) {
  const label = quality?.label || 'UNKNOWN';
  return {
    label,
    tone: qualityToneByLabel[label] || 'neutral',
    score: typeof quality?.score === 'number' ? quality.score : null,
  };
}

export function formatInsightDate(value) {
  if (!value) return 'Not available';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  } catch {
    return 'Not available';
  }
}

export function formatInsightPercentage(value) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round(value)}%`;
}

export function formatInsightScore(value) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round(value * 100)}%`;
}

export function groupNormalizedSkills(skills = []) {
  const grouped = new Map();

  for (const skill of skills) {
    const normalized = skill?.name?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    const category = skillCategoryRules.find(([, patterns]) => patterns.includes(key))?.[0] || 'Other';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(skill);
  }

  return [...grouped.entries()].map(([category, values]) => ({
    category,
    skills: values.sort((left, right) => left.name.localeCompare(right.name)),
  }));
}

export function hasPreviousCandidateIntelligenceResult(result) {
  return Boolean(result?.execution?.resultId);
}

export function isAiGeneratedStatement(statement) {
  return statement?.generationType === 'AI_GENERATED';
}

export function canRenderProfessionalSummary(result) {
  return Boolean(result?.summary?.professionalSummary?.text);
}

export function mapCandidateIntelligenceError(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to candidate intelligence for this profile.';
  if (status === 404) return 'Candidate intelligence is not available for this profile.';
  if (status === 409) return 'The candidate intelligence request could not be completed in the current state.';
  if (status === 429) return 'Candidate intelligence is temporarily rate limited. Try again shortly.';
  if ([502, 503].includes(status)) return 'Candidate intelligence is temporarily unavailable. Try again shortly.';
  return error?.message || 'Candidate intelligence could not be loaded.';
}

export function buildCandidateIntelligenceSupportReference(result) {
  return [result?.execution?.stateId ? `State ${result.execution.stateId}` : null, result?.execution?.executionId ? `Execution ${result.execution.executionId}` : null]
    .filter(Boolean)
    .join(' | ');
}
