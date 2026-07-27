import {
  resumeImportBatchStatusSchema,
  resumeImportDuplicateResolutionSchema,
  resumeImportItemStatusSchema,
} from '@careeriz/shared';

export const RESUME_IMPORT_BATCH_STATUSES = resumeImportBatchStatusSchema.options;
export const RESUME_IMPORT_ITEM_STATUSES = [...resumeImportItemStatusSchema.options, 'PROCESSING', 'CANCELLED'];
export const RESUME_IMPORT_DUPLICATE_RESOLUTIONS = resumeImportDuplicateResolutionSchema.options;
export const RESUME_IMPORT_TERMINAL_BATCH_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED']);
export const RESUME_IMPORT_TERMINAL_ITEM_STATUSES = new Set(['READY', 'IMPORTED', 'FAILED', 'CANCELLED']);

export const SUPPORTED_RESUME_IMPORT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.zip'];
export const RESUME_IMPORT_ACCEPT_ATTRIBUTE = '.pdf,.doc,.docx,.zip';

const batchStatusMeta = {
  QUEUED: { label: 'Queued', tone: 'neutral', description: 'Batch is waiting to be processed.' },
  UPLOADING: { label: 'Uploading', tone: 'info', description: 'Files are being accepted and stored.' },
  UPLOADED: { label: 'Uploaded', tone: 'info', description: 'Files were stored and background processing is starting.' },
  PROCESSING: { label: 'Processing', tone: 'warning', description: 'Items are being extracted and parsed.' },
  COMPLETED: { label: 'Completed', tone: 'success', description: 'All items completed successfully.' },
  PARTIAL: { label: 'Completed with review', tone: 'warning', description: 'Some items require review or retry.' },
  FAILED: { label: 'Failed', tone: 'danger', description: 'The batch did not complete successfully.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'The batch was cancelled.' },
};

const itemStatusMeta = {
  QUEUED: { label: 'Queued', tone: 'neutral', description: 'Waiting for worker pickup.' },
  UPLOADING: { label: 'Uploading', tone: 'info', description: 'File is being uploaded.' },
  UPLOADED: { label: 'Uploaded', tone: 'info', description: 'File is stored and waiting for processing.' },
  EXTRACTING: { label: 'Extracting', tone: 'warning', description: 'Resume text extraction is in progress.' },
  PARSING: { label: 'Parsing', tone: 'warning', description: 'AI or deterministic parsing is in progress.' },
  PROCESSING: { label: 'Processing', tone: 'warning', description: 'The item is being processed.' },
  REVIEW_REQUIRED: { label: 'Review required', tone: 'warning', description: 'Manual review is required before import.' },
  DUPLICATE: { label: 'Duplicate', tone: 'warning', description: 'A possible duplicate candidate requires resolution.' },
  READY: { label: 'Ready', tone: 'success', description: 'The item is ready for confirmation.' },
  IMPORTED: { label: 'Imported', tone: 'success', description: 'A candidate profile was created or linked.' },
  FAILED: { label: 'Failed', tone: 'danger', description: 'Processing failed and may be retryable.' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', description: 'The item was cancelled or rejected.' },
};

const errorCodeMessages = {
  MISSING_FILES: 'Select one or more resume files before starting the import.',
  EMPTY_IMPORT: 'No supported resume files were found in this upload.',
  IMPORT_FILE_LIMIT: 'This batch exceeds the maximum number of resumes allowed.',
  DUPLICATE_BATCH_FILE: 'Duplicate files were selected in the same batch.',
  UNSUPPORTED_FILE_TYPE: 'Only PDF, DOC, DOCX, and ZIP files are supported.',
  INVALID_FILE_TYPE: 'Only PDF, DOC, DOCX, and ZIP files are supported.',
  FILE_TOO_LARGE: 'One or more files exceed the configured maximum file size.',
  ZIP_COMBINED_WITH_FILES: 'Upload either one ZIP file or individual resumes, not both together.',
  ZIP_TRAVERSAL_BLOCKED: 'The ZIP archive contains unsafe file paths and was blocked.',
  ZIP_NESTED_NOT_ALLOWED: 'Nested ZIP files are not supported.',
  ZIP_ENCRYPTED_NOT_SUPPORTED: 'Encrypted ZIP archives are not supported.',
  ZIP_CORRUPT: 'The ZIP archive could not be read.',
  ZIP_BOMB_BLOCKED: 'The ZIP archive exceeds the uncompressed size limit.',
  PDF_IMAGE_ONLY: 'This PDF appears to be image-only and requires manual review.',
  DOC_MANUAL_REVIEW_REQUIRED: 'Legacy DOC files are stored, but require manual review.',
  AI_TIMEOUT: 'Parsing took too long and can be retried.',
  AI_INVALID_JSON: 'The AI parser returned an invalid response. Manual review is required.',
  AI_PARSING_FAILED: 'Resume parsing did not complete successfully.',
  RETRY_NOT_ALLOWED: 'This item cannot be retried in its current state.',
  NOT_DUPLICATE: 'This item is no longer in duplicate review.',
  ITEM_NOT_FOUND: 'The requested import item was not found.',
  BATCH_NOT_FOUND: 'The requested import batch was not found.',
};

export function getResumeImportBatchStatusMeta(status) {
  return batchStatusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized batch status: ${status}` : 'Batch status is unavailable.',
  };
}

export function getResumeImportItemStatusMeta(status) {
  return itemStatusMeta[status] || {
    label: 'Unknown status',
    tone: 'neutral',
    description: status ? `Unrecognized item status: ${status}` : 'Item status is unavailable.',
  };
}

export function getResumeImportErrorMessage(errorCode, fallbackMessage = '') {
  return errorCodeMessages[errorCode] || fallbackMessage || 'The resume import request could not be completed.';
}

export function formatResumeImportSupportReference({ batchId = null, itemId = null, filename = null, errorCode = null } = {}) {
  return [batchId ? `Batch ${batchId}` : null, itemId ? `Item ${itemId}` : null, filename ? `File ${filename}` : null, errorCode ? `Code ${errorCode}` : null]
    .filter(Boolean)
    .join(' | ');
}

export function calculateBatchProgress(batch) {
  const total = Number(batch?.totalItemCount || 0);
  const processed = Number(batch?.processedCount || 0);
  const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return { total, processed, percentage };
}

export function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'Not available';
  if (durationMs < 1000) return `${durationMs} ms`;

  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours ? `${hours}h` : null,
    minutes ? `${minutes}m` : null,
    seconds || (!hours && !minutes) ? `${seconds}s` : null,
  ].filter(Boolean);
  return parts.join(' ');
}

export function formatConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { label: 'Not available', tone: 'neutral' };
  }
  if (value >= 0.85) return { label: 'High', tone: 'success' };
  if (value >= 0.6) return { label: 'Medium', tone: 'info' };
  return { label: 'Low', tone: 'warning' };
}

export function hasMinimumIdentityFields(values = {}) {
  return Boolean(values.fullName && (values.email || values.phoneNumber || values.linkedInUrl));
}

export function extractParsedCandidateFields(item) {
  const candidate = item?.parsedData?.candidate || {};
  const readField = (field, fallback = null) => candidate[field]?.value ?? fallback;
  return {
    fullName: readField('fullName', ''),
    email: readField('email', ''),
    phoneNumber: readField('phoneNumber', ''),
    linkedInUrl: readField('linkedInUrl', ''),
    currentTitle: readField('currentTitle', ''),
    currentEmployer: readField('currentEmployer', ''),
    location: readField('location', ''),
    summary: readField('summary', ''),
    skills: Array.isArray(readField('skills', [])) ? readField('skills', []) : [],
  };
}

