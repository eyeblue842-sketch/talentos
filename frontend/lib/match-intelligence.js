import {
  candidateJobMatchResponseSchema,
  candidateJobMatchStatusResponseSchema,
  candidateRankingResponseSchema,
  candidateRankingSnapshotResponseSchema,
} from '@careeriz/shared';

export const CANDIDATE_MATCH_TERMINAL_STATUSES = new Set([
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'REVIEW_REQUIRED',
]);

export const CANDIDATE_RANKING_TERMINAL_STATUSES = new Set([
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'PARTIAL',
]);

const statusMeta = {
  READY: {
    label: 'Insights ready',
    tone: 'success',
    description: 'A persisted candidate-job match result is available.',
  },
  STALE: {
    label: 'Candidate or job changed',
    tone: 'warning',
    description: 'The current match result was generated before the latest candidate or job update.',
  },
  PENDING: {
    label: 'Generating match',
    tone: 'info',
    description: 'A background match generation task is currently running.',
  },
  FAILED: {
    label: 'Generation failed',
    tone: 'danger',
    description: 'The latest match generation attempt did not complete successfully.',
  },
  DISABLED: {
    label: 'AI generation unavailable',
    tone: 'neutral',
    description: 'Only deterministic signals are available because AI generation is disabled.',
  },
  REVIEW_REQUIRED: {
    label: 'Review required',
    tone: 'warning',
    description: 'More source information is needed before richer candidate-job matching is available.',
  },
  PARTIAL: {
    label: 'Partially ready',
    tone: 'warning',
    description: 'Ranking completed with partial candidate coverage.',
  },
};

const recommendationMeta = {
  STRONG_MATCH: { label: 'Strong match', tone: 'success' },
  MATCH: { label: 'Match', tone: 'info' },
  PARTIAL_MATCH: { label: 'Partial match', tone: 'warning' },
  LIMITED_MATCH: { label: 'Limited match', tone: 'neutral' },
  REVIEW_REQUIRED: { label: 'Review required', tone: 'warning' },
};

const confidenceToneByLabel = {
  HIGH: 'success',
  MEDIUM: 'info',
  LOW: 'warning',
  UNKNOWN: 'neutral',
};

export function parseCandidateJobMatchResponse(payload) {
  return candidateJobMatchResponseSchema.parse(payload);
}

export function parseCandidateJobMatchStatusResponse(payload) {
  return candidateJobMatchStatusResponseSchema.parse(payload);
}

export function parseCandidateRankingResponse(payload) {
  return candidateRankingResponseSchema.parse(payload);
}

export function parseCandidateRankingStatusResponse(payload) {
  return candidateRankingSnapshotResponseSchema.parse(payload);
}

export function getCandidateMatchStatusMeta(status) {
  return statusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized candidate match status: ${status}` : 'Candidate match status is unavailable.',
  };
}

export function getCandidateRankingStatusMeta(status) {
  return getCandidateMatchStatusMeta(status);
}

export function getRecommendationMeta(label) {
  return recommendationMeta[label] || {
    label: 'Unknown recommendation',
    tone: 'neutral',
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

export function formatMatchDate(value) {
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

export function formatMatchPercent(value, scale = 100) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round((Number(value) / scale) * 100)}%`;
}

export function formatMatchDecimal(value) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.round(Number(value) * 100)}%`;
}

export function hasPreviousCandidateMatchResult(result) {
  return Boolean(result?.execution?.resultId);
}

export function hasPreviousCandidateRankingSnapshot(snapshot) {
  return Boolean(snapshot?.id);
}

export function isAiGeneratedStatement(statement) {
  return statement?.generationType === 'AI_GENERATED';
}

export function mapCandidateMatchError(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 400) return 'The candidate-job match request was invalid.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to candidate-job matching for this record.';
  if (status === 404) return 'Candidate-job matching is not available for this candidate or job.';
  if (status === 409) return 'The candidate-job match request could not be completed in the current state.';
  if (status === 413) return 'The request was too large for the server to process.';
  if (status === 429) return 'Candidate-job matching is temporarily rate limited. Try again shortly.';
  if ([502, 503].includes(status)) return 'Candidate-job matching is temporarily unavailable. Try again shortly.';
  return error?.message || 'Candidate-job matching could not be loaded.';
}

export function mapCandidateRankingError(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 400) return 'The candidate ranking request was invalid.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to AI candidate ranking for this job.';
  if (status === 404) return 'AI candidate ranking is not available for this job.';
  if (status === 409) return 'The ranking request could not be completed in the current state.';
  if (status === 429) return 'AI candidate ranking is temporarily rate limited. Try again shortly.';
  if ([502, 503].includes(status)) return 'AI candidate ranking is temporarily unavailable. Try again shortly.';
  return error?.message || 'Candidate ranking could not be loaded.';
}

export function buildCandidateMatchSupportReference(result) {
  return [
    result?.execution?.stateId ? `State ${result.execution.stateId}` : null,
    result?.execution?.executionId ? `Execution ${result.execution.executionId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function buildCandidateRankingSupportReference(snapshot) {
  return [
    snapshot?.id ? `Snapshot ${snapshot.id}` : null,
    snapshot?.latestExecutionId ? `Execution ${snapshot.latestExecutionId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}
