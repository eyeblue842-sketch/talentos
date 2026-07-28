import {
  jobDescriptionDraftResponseSchema,
  jobDescriptionHistoryResponseSchema,
  jobDescriptionResultSchema,
  jobDescriptionStatusResponseSchema,
  jobDescriptionTemplateResponseSchema,
} from '@careeriz/shared';

export const JOB_DESCRIPTION_TERMINAL_STATUSES = new Set([
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'REVIEW_REQUIRED',
]);

const statusMeta = {
  READY: {
    label: 'Job description ready',
    tone: 'success',
    description: 'The latest AI job description result is available.',
  },
  PENDING: {
    label: 'Generating job description',
    tone: 'info',
    description: 'A background generation task is running for this job description.',
  },
  STALE: {
    label: 'Job information changed',
    tone: 'warning',
    description: 'The current result was generated before the latest job information update.',
  },
  FAILED: {
    label: 'Generation failed',
    tone: 'danger',
    description: 'The last generation attempt did not complete successfully.',
  },
  DISABLED: {
    label: 'AI generation unavailable',
    tone: 'neutral',
    description: 'AI generation is currently disabled. No new AI output will be produced.',
  },
  REVIEW_REQUIRED: {
    label: 'Review required',
    tone: 'warning',
    description: 'This job needs more structured source information before richer AI output is available.',
  },
};

export function parseJobDescriptionResult(payload) {
  return jobDescriptionResultSchema.parse(payload);
}

export function parseJobDescriptionStatus(payload) {
  return jobDescriptionStatusResponseSchema.parse(payload);
}

export function parseJobDescriptionDraft(payload) {
  return jobDescriptionDraftResponseSchema.parse(payload);
}

export function parseJobDescriptionDraftList(payload) {
  return jobDescriptionDraftResponseSchema.array().parse(payload);
}

export function parseJobDescriptionTemplateList(payload) {
  return jobDescriptionTemplateResponseSchema.array().parse(payload);
}

export function parseJobDescriptionHistory(payload) {
  return jobDescriptionHistoryResponseSchema.parse(payload);
}

export function getJobDescriptionStatusMeta(status) {
  return statusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized job description status: ${status}` : 'Job description status is unavailable.',
  };
}

export function formatJobDescriptionDate(value) {
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

export function hasPreviousJobDescriptionResult(result) {
  return Boolean(result?.execution?.resultId);
}

export function mapJobDescriptionError(error) {
  const status = error?.statusCode || error?.status || 500;
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to AI job description generation for this job.';
  if (status === 404) return 'AI job description is not available for this job.';
  if (status === 409) return 'The job description request could not be completed in the current state.';
  if (status === 413) return 'The request was too large for the server to process.';
  if (status === 429) return 'AI job description is temporarily rate limited. Try again shortly.';
  if ([502, 503].includes(status)) return 'AI job description is temporarily unavailable. Try again shortly.';
  return error?.message || 'AI job description could not be loaded.';
}

export function buildJobDescriptionSupportReference(result) {
  return [
    result?.execution?.stateId ? `State ${result.execution.stateId}` : null,
    result?.execution?.executionId ? `Execution ${result.execution.executionId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function getJobDraftStatusMeta(status) {
  if (status === 'DRAFT') return { label: 'Draft', tone: 'neutral' };
  if (status === 'APPROVED') return { label: 'Approved', tone: 'info' };
  if (status === 'APPLIED') return { label: 'Applied', tone: 'success' };
  if (status === 'ARCHIVED') return { label: 'Archived', tone: 'warning' };
  return { label: 'Unknown draft status', tone: 'neutral' };
}

export function formatJobDescriptionActor(actorUserId) {
  if (!actorUserId) return 'System';
  return `User ${String(actorUserId).slice(-8)}`;
}

export function buildDraftVersionLabel(draft) {
  if (!draft) return 'Unsaved draft';
  return `v${draft.version}`;
}

export function buildDraftActivityLabel(draft) {
  if (!draft) return 'Saved draft';
  if (draft.status === 'APPLIED' || draft.appliedAt) return 'Applied';
  if (draft.previousVersionId) return 'Edited';
  if (draft.sourceResultId) return 'Generated';
  return 'Saved Draft';
}
