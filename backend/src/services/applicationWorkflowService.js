import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { storePrivateFile, readPrivateFileNodeStream } from '../config/storage.js';
import { requireOrganisationRole, requireOrganisationContext } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { enqueueBackgroundTask } from './backgroundTaskService.js';
import { sendRecruiterApplicationNotificationEmail } from './emailService.js';
import { markCandidateIntelligenceStale } from '../intelligence/services/candidateIntelligenceService.js';
import { touchCandidateLastActive } from './candidateActivityService.js';
import {
  archiveResumeAssetRecord,
  countApplicationResumeSnapshotReferences,
  countCandidateJobApplications,
  countJobScreeningQuestions,
  countRecruiterJobApplications,
  countScreeningTemplates,
  createJobScreeningQuestionRecord,
  createResumeAssetRecord,
  createScreeningTemplateRecord,
  deactivateOtherPrimaryResumes,
  deleteJobScreeningQuestionRecord,
  deleteResumeAssetRecord,
  findActiveJobScreeningQuestions,
  findActiveReplacementResume,
  findApplicationResumeSnapshot,
  findApplicationScreeningAnswerFile,
  findCandidateJobApplicationDetail,
  findCandidateJobApplications,
  findCandidateProfile,
  findCandidateProfileWithUser,
  findCandidateResumeAssetsByCandidate,
  findCandidateWithdrawalApplication,
  findJobApplicationByJobAndCandidate,
  findJobForApplicationValidation,
  findJobForOrganisation,
  findJobScreeningQuestion,
  findJobScreeningQuestionIds,
  findJobScreeningQuestions,
  findOwnedDownloadResumeAsset,
  findOwnedResumeAsset,
  findPublicJobBySlug,
  findRecruiterJobApplicationDetail,
  findRecruiterJobApplications,
  findScreeningFileAsset,
  findScreeningTemplate,
  findScreeningTemplates,
  markResumeAssetPrimary,
  reorderJobScreeningQuestionsRecord,
  restoreResumeAssetRecord,
  setPrimaryResumeAssetRecord,
  submitJobApplicationRecord,
  updateCandidateProfileLatestResume,
  updateCandidateProfileRecord,
  updateCandidateProfileResumeLink,
  updateJobScreeningQuestionRecord,
  updateResumeAssetParsedReview,
  updateResumeAssetParsing,
  updateScreeningTemplateRecord,
  withdrawCandidateApplicationRecord,
} from '../repositories/applicationWorkflow/applicationWorkflowRepository.js';

const recruiterWritableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
const recruiterReadableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const SOURCE_VALUE_MAX = 120;
const REFERRER_MAX = 300;
const PUBLIC_REFERENCE_LENGTH = 10;
const DEFAULT_ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'doc', 'docx'];
const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const ANSWER_FILE_MAX_BYTES = 5 * 1024 * 1024;
const candidateWithdrawalAllowedStages = ['APPLIED', 'SHORTLISTED'];
const candidateVisibleStatusMap = {
  APPLIED: { code: 'APPLICATION_RECEIVED', label: 'Application Received', group: 'ACTIVE' },
  SHORTLISTED: { code: 'UNDER_REVIEW', label: 'Under Review', group: 'ACTIVE' },
  INTERVIEW_SCHEDULED: { code: 'INTERVIEW_STAGE', label: 'Interview Stage', group: 'INTERVIEW' },
  SELECTED: { code: 'SELECTED', label: 'Selected', group: 'CLOSED' },
  REJECTED: { code: 'APPLICATION_CLOSED', label: 'Application Closed', group: 'CLOSED' },
  WITHDRAWN: { code: 'APPLICATION_WITHDRAWN', label: 'Application Withdrawn', group: 'WITHDRAWN' },
};

const candidateStatusLabelMap = {
  'Ready for Offer': { code: 'READY_FOR_OFFER', label: 'Ready for Offer', group: 'OFFER' },
  'Offer Draft': { code: 'OFFER_DRAFT', label: 'Offer Draft', group: 'OFFER' },
  'Offer Pending Approval': { code: 'OFFER_PENDING_APPROVAL', label: 'Approval Pending', group: 'OFFER' },
  'Offer Released': { code: 'OFFER_RELEASED', label: 'Offer Released', group: 'OFFER' },
  'Offer Accepted': { code: 'OFFER_ACCEPTED', label: 'Offer Accepted', group: 'OFFER' },
  'Offer Rejected': { code: 'OFFER_REJECTED', label: 'Offer Rejected', group: 'CLOSED' },
  'Offer Withdrawn': { code: 'OFFER_WITHDRAWN', label: 'Offer Withdrawn', group: 'CLOSED' },
  'Offer Expired': { code: 'OFFER_EXPIRED', label: 'Offer Expired', group: 'CLOSED' },
  'Joining Confirmed': { code: 'JOINING_CONFIRMED', label: 'Joining Confirmed', group: 'OFFER' },
  'Joining Deferred': { code: 'JOINING_DEFERRED', label: 'Joining Deferred', group: 'OFFER' },
  Joined: { code: 'JOINED', label: 'Joined', group: 'CLOSED' },
  'No Show': { code: 'NO_SHOW', label: 'No Show', group: 'CLOSED' },
};

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function buildMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function clampPage(page, pageSize, total) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), pageCount);
}

function getCandidateVisibleStatus(stage, statusLabel = null) {
  if (statusLabel && candidateStatusLabelMap[statusLabel]) {
    return candidateStatusLabelMap[statusLabel];
  }
  return candidateVisibleStatusMap[stage] || candidateVisibleStatusMap.APPLIED;
}

function getCandidateTimelineMessage(stage, jobTitle) {
  switch (stage) {
    case 'SHORTLISTED':
      return `Your application for ${jobTitle} is under review.`;
    case 'INTERVIEW_SCHEDULED':
      return `Your application for ${jobTitle} has moved to the interview stage.`;
    case 'SELECTED':
      return `You have been selected for ${jobTitle}.`;
    case 'REJECTED':
      return `Your application for ${jobTitle} has been closed.`;
    case 'WITHDRAWN':
      return `Your application for ${jobTitle} was withdrawn.`;
    case 'APPLIED':
    default:
      return `Your application for ${jobTitle} was received.`;
  }
}

function buildCandidateSafeTimelineItem(item) {
  return {
    id: item.id,
    eventType: item.eventType,
    message: item.message,
    metadata: item.metadata,
    isCandidateVisible: item.isCandidateVisible,
    createdAt: iso(item.createdAt),
  };
}

function buildCandidateApplicationStatus(application) {
  const visible = getCandidateVisibleStatus(application.application?.currentStage || 'APPLIED', application.application?.statusLabel || null);
  return {
    candidateStatus: visible.code,
    candidateStatusLabel: visible.label,
    candidateStatusGroup: visible.group,
  };
}

function sanitizeText(value, max = SOURCE_VALUE_MAX) {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, max) : null;
}

function sanitizeReferrer(value) {
  const normalized = sanitizeText(value, REFERRER_MAX);
  if (!normalized) return null;
  try {
    return new URL(normalized).toString().slice(0, REFERRER_MAX);
  } catch {
    return null;
  }
}

function sanitizeSource(source = {}) {
  return {
    sourceType: sanitizeText(source.sourceType, 40) || 'UNKNOWN',
    sourceName: sanitizeText(source.sourceName),
    sourceCampaign: sanitizeText(source.sourceCampaign),
    utmSource: sanitizeText(source.utmSource),
    utmMedium: sanitizeText(source.utmMedium),
    utmCampaign: sanitizeText(source.utmCampaign),
    utmTerm: sanitizeText(source.utmTerm),
    utmContent: sanitizeText(source.utmContent),
    referrer: sanitizeReferrer(source.referrer),
    directLinkIdentifier: sanitizeText(source.directLinkIdentifier),
  };
}

function questionSupportsOptions(questionType) {
  return ['SINGLE_SELECT', 'MULTI_SELECT'].includes(questionType);
}

function questionSupportsTextValidation(questionType) {
  return ['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'URL'].includes(questionType);
}

function questionSupportsNumberValidation(questionType) {
  return ['NUMBER', 'CURRENCY'].includes(questionType);
}

function normalizeQuestionPayload(payload, displayOrder = 0) {
  const config = payload.config || {};
  const validationConfig = payload.validationConfig || {};
  return {
    templateId: payload.templateId || null,
    questionText: String(payload.questionText || '').trim(),
    internalLabel: sanitizeText(payload.internalLabel, 160),
    helpText: sanitizeText(payload.helpText, 500),
    placeholder: sanitizeText(payload.placeholder, 200),
    questionType: payload.questionType,
    required: Boolean(payload.required),
    displayOrder: Number.isInteger(payload.displayOrder) ? payload.displayOrder : displayOrder,
    isActive: payload.isActive !== false,
    config: questionSupportsOptions(payload.questionType)
      ? {
          options: (config.options || []).map((option, index) => ({
            id: option.id || `option-${index + 1}`,
            label: String(option.label || '').trim(),
            value: String(option.value || '').trim(),
          })),
        }
      : {},
    validationConfig: {
      minTextLength: questionSupportsTextValidation(payload.questionType) ? validationConfig.minTextLength ?? null : null,
      maxTextLength: questionSupportsTextValidation(payload.questionType) ? validationConfig.maxTextLength ?? null : null,
      minNumber: questionSupportsNumberValidation(payload.questionType) ? validationConfig.minNumber ?? null : null,
      maxNumber: questionSupportsNumberValidation(payload.questionType) ? validationConfig.maxNumber ?? null : null,
      allowedCurrency: payload.questionType === 'CURRENCY' ? sanitizeText(validationConfig.allowedCurrency, 10) : null,
      allowedFileTypes: payload.questionType === 'FILE_UPLOAD'
        ? (validationConfig.allowedFileTypes || DEFAULT_ALLOWED_UPLOAD_EXTENSIONS).map((item) => String(item).toLowerCase())
        : [],
      maxFileSizeBytes: payload.questionType === 'FILE_UPLOAD'
        ? Number(validationConfig.maxFileSizeBytes || ANSWER_FILE_MAX_BYTES)
        : null,
      urlValidation: payload.questionType === 'URL' ? validationConfig.urlValidation !== false : false,
      emailValidation: payload.questionType === 'EMAIL' ? validationConfig.emailValidation !== false : false,
      phoneValidation: payload.questionType === 'PHONE' ? validationConfig.phoneValidation !== false : false,
    },
    rules: (payload.rules || []).map((rule) => ({
      operator: rule.operator,
      value: rule.value,
      outcome: rule.outcome,
      reason: String(rule.reason || '').trim(),
    })),
  };
}

function validateQuestionConfiguration(payload) {
  const normalized = normalizeQuestionPayload(payload);
  const options = normalized.config.options || [];

  if (questionSupportsOptions(normalized.questionType) && options.length < 2) {
    const error = new Error('Select questions require at least two options.');
    error.statusCode = 422;
    throw error;
  }

  if (!questionSupportsOptions(normalized.questionType) && options.length) {
    const error = new Error('Options can only be used with select questions.');
    error.statusCode = 422;
    throw error;
  }

  if (normalized.validationConfig.minTextLength != null
    && normalized.validationConfig.maxTextLength != null
    && normalized.validationConfig.minTextLength > normalized.validationConfig.maxTextLength) {
    const error = new Error('Minimum text length must not exceed maximum text length.');
    error.statusCode = 422;
    throw error;
  }

  if (normalized.validationConfig.minNumber != null
    && normalized.validationConfig.maxNumber != null
    && normalized.validationConfig.minNumber > normalized.validationConfig.maxNumber) {
    const error = new Error('Minimum numeric value must not exceed maximum numeric value.');
    error.statusCode = 422;
    throw error;
  }

  for (const rule of normalized.rules) {
    validateRuleCompatibility(normalized.questionType, rule);
  }

  return normalized;
}

function validateRuleCompatibility(questionType, rule) {
  const operator = rule.operator;
  const isNumeric = ['NUMBER', 'CURRENCY'].includes(questionType);
  const isTextual = ['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'URL', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(questionType);
  const isBoolean = questionType === 'YES_NO';
  const isDate = questionType === 'DATE';

  if (['LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL'].includes(operator)
    && !isNumeric
    && !isDate) {
    const error = new Error(`Operator ${operator} is not compatible with ${questionType}.`);
    error.statusCode = 422;
    throw error;
  }

  if (['CONTAINS', 'DOES_NOT_CONTAIN'].includes(operator) && !isTextual) {
    const error = new Error(`Operator ${operator} is not compatible with ${questionType}.`);
    error.statusCode = 422;
    throw error;
  }

  if (isBoolean && !['EQUALS', 'NOT_EQUALS'].includes(operator)) {
    const error = new Error(`Operator ${operator} is not compatible with ${questionType}.`);
    error.statusCode = 422;
    throw error;
  }
}

function serializeQuestion(question) {
  return {
    id: question.id,
    templateId: question.templateId,
    questionText: question.questionText,
    internalLabel: question.internalLabel,
    helpText: question.helpText,
    placeholder: question.placeholder,
    questionType: question.questionType,
    required: question.required,
    displayOrder: question.displayOrder,
    isActive: question.isActive,
    config: question.config || {},
    validationConfig: question.validationConfig || {},
    rules: question.rules || [],
    templateUsageCount: question._count?.answers,
    createdAt: iso(question.createdAt),
    updatedAt: iso(question.updatedAt),
  };
}

function serializeTemplate(template) {
  return {
    id: template.id,
    questionText: template.questionText,
    internalLabel: template.internalLabel,
    helpText: template.helpText,
    placeholder: template.placeholder,
    questionType: template.questionType,
    isRequiredByDefault: template.isRequiredByDefault,
    displayOrder: template.displayOrder,
    isActive: template.isActive,
    config: template.config || {},
    validationConfig: template.validationConfig || {},
    usageCount: template._count?.jobScreeningQuestions || 0,
    createdAt: iso(template.createdAt),
    updatedAt: iso(template.updatedAt),
  };
}

function serializeResumeAsset(asset) {
  const failureCode = asset.parsedData?.errorCode || null;
  const parsingStatusMeta = (() => {
    switch (asset.parsingStatus) {
      case 'PROCESSING':
        return {
          label: 'Parsing resume',
          message: 'Careeriz is extracting and organizing resume details in the background.',
        };
      case 'COMPLETED':
        return {
          label: 'Parsed successfully',
          message: 'Resume details are available to review and apply to your profile.',
        };
      case 'PARTIAL':
        return {
          label: 'Needs review',
          message: 'Careeriz extracted limited resume data and skipped low-confidence updates. Review the resume or retry parsing.',
        };
      case 'FAILED':
        return {
          label: 'Parsing failed',
          message: failureCode === 'PDF_IMAGE_ONLY'
            ? 'Unable to extract readable text from this resume. It may be image-only or scanned without OCR support.'
            : failureCode === 'PDF_TEXT_LOW_QUALITY' || failureCode === 'DOCX_TEXT_LOW_QUALITY' || failureCode === 'DOC_TEXT_LOW_QUALITY'
              ? 'We extracted unreadable resume text and skipped profile updates. Please retry with a cleaner PDF/DOC/DOCX file.'
              : failureCode === 'UNSUPPORTED_FILE_TYPE'
                ? 'Resume format is unsupported for parsing.'
                : failureCode === 'AI_PROVIDER_UNAVAILABLE'
                  ? 'AI parsing service is unavailable right now. Please retry parsing later.'
                  : 'We could not fully parse this resume. Your uploaded file is safe. You can retry parsing or update your profile manually.',
        };
      case 'PENDING':
      default:
        return {
          label: 'Queued for parsing',
          message: 'Your resume is queued for parsing.',
        };
    }
  })();

  return {
    id: asset.id,
    filename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    source: asset.source,
    status: asset.status,
    isPrimary: asset.isPrimary,
    parsingStatus: asset.parsingStatus,
    parsingStatusLabel: parsingStatusMeta.label,
    parsingStatusMessage: parsingStatusMeta.message,
    parsedData: asset.parsedData || null,
    createdAt: iso(asset.createdAt),
    updatedAt: iso(asset.updatedAt),
    archivedAt: iso(asset.archivedAt),
    externalResumeId: asset.externalResumeId,
    externalResumeUrl: asset.externalResumeUrl,
    externalResumeVersion: asset.externalResumeVersion,
    lastSynchronizedAt: iso(asset.lastSynchronizedAt),
    downloadUrl: `/api/candidate/resumes/${asset.id}/download`,
  };
}

function buildEligibility(job, applicationCount, hasApplied, candidateProfile) {
  if (!job) {
    return { canApply: false, reasonCode: 'JOB_CLOSED', requiresLogin: false };
  }

  const now = new Date();
  const requiresInternalAccess = job.visibility === 'INTERNAL';

  if (job.status !== 'OPEN') return { canApply: false, reasonCode: 'JOB_CLOSED', requiresLogin: false };
  if (job.applicationOpensAt && new Date(job.applicationOpensAt) > now) return { canApply: false, reasonCode: 'APPLICATION_NOT_OPEN', requiresLogin: false };
  if (job.applicationClosesAt && new Date(job.applicationClosesAt) < now) return { canApply: false, reasonCode: 'APPLICATION_CLOSED', requiresLogin: false };
  if (job.applicationDeadline && new Date(job.applicationDeadline) < now) return { canApply: false, reasonCode: 'APPLICATION_CLOSED', requiresLogin: false };
  if (job.maxApplications && applicationCount >= job.maxApplications) return { canApply: false, reasonCode: 'MAX_APPLICATIONS_REACHED', requiresLogin: false };
  if (hasApplied) return { canApply: false, reasonCode: 'ALREADY_APPLIED', requiresLogin: false };
  if (requiresInternalAccess && !candidateProfile) return { canApply: false, reasonCode: 'LOGIN_REQUIRED', requiresLogin: true };
  if (!candidateProfile) return { canApply: true, reasonCode: 'LOGIN_REQUIRED', requiresLogin: true };
  if (!candidateProfile.latestResumeAssetId && !candidateProfile.resumeUrl) return { canApply: false, reasonCode: 'RESUME_REQUIRED', requiresLogin: false };
  if (!candidateProfile.fullName || !candidateProfile.currentTitle) return { canApply: false, reasonCode: 'PROFILE_REQUIREMENTS_INCOMPLETE', requiresLogin: false };
  return { canApply: true, reasonCode: null, requiresLogin: false };
}

function getAllowedFileExtensions(question) {
  const configured = question.validationConfig?.allowedFileTypes || [];
  return configured.length ? configured.map((item) => String(item).toLowerCase()) : DEFAULT_ALLOWED_UPLOAD_EXTENSIONS;
}

function getFileExtension(filename) {
  const parts = String(filename || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function validateAnswerAgainstQuestion(question, rawAnswer) {
  const value = rawAnswer?.value;
  const fileAssetId = rawAnswer?.fileAssetId || null;

  if (question.required && (value == null || value === '' || (Array.isArray(value) && !value.length)) && !fileAssetId) {
    const error = new Error(`Answer required for "${question.questionText}".`);
    error.statusCode = 422;
    throw error;
  }

  switch (question.questionType) {
    case 'YES_NO':
      if (value != null && typeof value !== 'boolean') throw validationError(question, 'Expected a boolean answer.');
      return { answerValue: value ?? null, fileAssetId: null };
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      if (value != null && typeof value !== 'string') throw validationError(question, 'Expected a text answer.');
      if (typeof value === 'string') {
        const min = question.validationConfig?.minTextLength;
        const max = question.validationConfig?.maxTextLength;
        if (min != null && value.length < min) throw validationError(question, `Answer must be at least ${min} characters.`);
        if (max != null && value.length > max) throw validationError(question, `Answer must be at most ${max} characters.`);
      }
      return { answerValue: value ?? null, fileAssetId: null };
    case 'EMAIL':
      if (value != null && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw validationError(question, 'Expected a valid email address.');
      return { answerValue: value ?? null, fileAssetId: null };
    case 'PHONE':
      if (value != null && (typeof value !== 'string' || !/^[+0-9()\-\s]{7,20}$/.test(value))) throw validationError(question, 'Expected a valid phone number.');
      return { answerValue: value ?? null, fileAssetId: null };
    case 'URL':
      if (value != null) {
        try {
          new URL(String(value));
        } catch {
          throw validationError(question, 'Expected a valid URL.');
        }
      }
      return { answerValue: value ?? null, fileAssetId: null };
    case 'NUMBER':
    case 'CURRENCY': {
      if (value != null && Number.isNaN(Number(value))) throw validationError(question, 'Expected a numeric answer.');
      const numericValue = value == null ? null : Number(value);
      const min = question.validationConfig?.minNumber;
      const max = question.validationConfig?.maxNumber;
      if (numericValue != null && min != null && numericValue < min) throw validationError(question, `Answer must be at least ${min}.`);
      if (numericValue != null && max != null && numericValue > max) throw validationError(question, `Answer must be at most ${max}.`);
      return { answerValue: numericValue, fileAssetId: null };
    }
    case 'DATE':
      if (value != null && Number.isNaN(new Date(value).getTime())) throw validationError(question, 'Expected a valid date.');
      return { answerValue: value ?? null, fileAssetId: null };
    case 'SINGLE_SELECT': {
      const allowedValues = new Set((question.config?.options || []).map((item) => item.value));
      if (value != null && (typeof value !== 'string' || !allowedValues.has(value))) throw validationError(question, 'Expected a valid option.');
      return { answerValue: value ?? null, fileAssetId: null };
    }
    case 'MULTI_SELECT': {
      const allowedValues = new Set((question.config?.options || []).map((item) => item.value));
      if (value != null && (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !allowedValues.has(item)))) {
        throw validationError(question, 'Expected an array of valid options.');
      }
      return { answerValue: value ?? [], fileAssetId: null };
    }
    case 'FILE_UPLOAD':
      if (!fileAssetId && question.required) throw validationError(question, 'Expected an uploaded file.');
      return { answerValue: fileAssetId ? { fileAssetId } : null, fileAssetId };
    default:
      return { answerValue: value ?? null, fileAssetId: null };
  }
}

function validationError(question, message) {
  const error = new Error(`${question.questionText}: ${message}`);
  error.statusCode = 422;
  return error;
}

function evaluateRule(operator, answerValue, ruleValue) {
  switch (operator) {
    case 'EQUALS':
      return answerValue === ruleValue;
    case 'NOT_EQUALS':
      return answerValue !== ruleValue;
    case 'LESS_THAN':
      return answerValue < ruleValue;
    case 'LESS_THAN_OR_EQUAL':
      return answerValue <= ruleValue;
    case 'GREATER_THAN':
      return answerValue > ruleValue;
    case 'GREATER_THAN_OR_EQUAL':
      return answerValue >= ruleValue;
    case 'CONTAINS':
      return Array.isArray(answerValue) ? answerValue.includes(ruleValue) : String(answerValue || '').toLowerCase().includes(String(ruleValue).toLowerCase());
    case 'DOES_NOT_CONTAIN':
      return Array.isArray(answerValue) ? !answerValue.includes(ruleValue) : !String(answerValue || '').toLowerCase().includes(String(ruleValue).toLowerCase());
    case 'IN':
      return Array.isArray(ruleValue) ? ruleValue.includes(answerValue) : false;
    case 'NOT_IN':
      return Array.isArray(ruleValue) ? !ruleValue.includes(answerValue) : false;
    default:
      return false;
  }
}

function generatePublicReference() {
  return crypto.randomBytes(PUBLIC_REFERENCE_LENGTH).toString('hex').slice(0, PUBLIC_REFERENCE_LENGTH).toUpperCase();
}

async function ensureJobForOrganisation(jobId, organisationId) {
  const job = await findJobForOrganisation(jobId, organisationId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  return job;
}

async function ensurePublicJob(slug) {
  const job = await findPublicJobBySlug(slug);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  return job;
}

async function ensureTemplate(organisationId, templateId) {
  const template = await findScreeningTemplate(organisationId, templateId);
  if (!template) {
    const error = new Error('Screening question template not found.');
    error.statusCode = 404;
    throw error;
  }
  return template;
}

async function ensureOwnedResumeAsset(candidateId, assetId) {
  const asset = await findOwnedResumeAsset(candidateId, assetId);
  if (!asset) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }
  return asset;
}

async function ensureAnswerFileAsset(candidateId, assetId) {
  const asset = await findScreeningFileAsset(candidateId, assetId);
  if (!asset) {
    const error = new Error('Uploaded file not found.');
    error.statusCode = 404;
    throw error;
  }
  return asset;
}

export async function listScreeningTemplates(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const where = {
    organisationId: context.organisationId,
    questionType: filters.questionType || undefined,
    isActive: filters.isActive === undefined ? undefined : filters.isActive,
    OR: filters.search
      ? [
          { questionText: { contains: filters.search, mode: 'insensitive' } },
          { internalLabel: { contains: filters.search, mode: 'insensitive' } },
        ]
      : undefined,
  };
  const total = await countScreeningTemplates(where);
  const page = clampPage(requestedPage, pageSize, total);
  const rows = await findScreeningTemplates(where, (page - 1) * pageSize, pageSize);
  return {
    items: rows.map(serializeTemplate),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function createScreeningTemplate(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const normalized = validateQuestionConfiguration({
    ...payload,
    required: payload.isRequiredByDefault ?? payload.required ?? false,
  });
  const created = await createScreeningTemplateRecord({
    organisationId: context.organisationId,
    createdById: actorUser.id,
    questionText: normalized.questionText,
    internalLabel: normalized.internalLabel,
    helpText: normalized.helpText,
    placeholder: normalized.placeholder,
    questionType: normalized.questionType,
    isRequiredByDefault: Boolean(payload.isRequiredByDefault ?? payload.required),
    displayOrder: normalized.displayOrder,
    isActive: payload.isActive !== false,
    config: normalized.config,
    validationConfig: normalized.validationConfig,
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'screening-template.create',
    entityType: 'ScreeningQuestionTemplate',
    entityId: created.id,
    afterData: created,
    ...requestMeta,
  });
  return serializeTemplate(created);
}

export async function updateScreeningTemplate(actorUser, templateId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await ensureTemplate(context.organisationId, templateId);
  const normalized = validateQuestionConfiguration({ ...existing, ...payload });
  const updated = await updateScreeningTemplateRecord(templateId, {
    questionText: normalized.questionText,
    internalLabel: normalized.internalLabel,
    helpText: normalized.helpText,
    placeholder: normalized.placeholder,
    questionType: normalized.questionType,
    isRequiredByDefault: payload.isRequiredByDefault ?? existing.isRequiredByDefault,
    displayOrder: normalized.displayOrder,
    isActive: payload.isActive ?? existing.isActive,
    config: normalized.config,
    validationConfig: normalized.validationConfig,
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'screening-template.update',
    entityType: 'ScreeningQuestionTemplate',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ...requestMeta,
  });
  return serializeTemplate(updated);
}

export async function archiveScreeningTemplate(actorUser, templateId, isActive, organisationId = null, requestMeta = {}) {
  return updateScreeningTemplate(actorUser, templateId, { isActive }, organisationId, requestMeta);
}

export async function duplicateScreeningTemplate(actorUser, templateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await ensureTemplate(context.organisationId, templateId);
  const created = await createScreeningTemplateRecord({
    organisationId: context.organisationId,
    createdById: actorUser.id,
    questionText: `${existing.questionText} (Copy)`,
    internalLabel: existing.internalLabel,
    helpText: existing.helpText,
    placeholder: existing.placeholder,
    questionType: existing.questionType,
    isRequiredByDefault: existing.isRequiredByDefault,
    displayOrder: existing.displayOrder,
    isActive: existing.isActive,
    config: existing.config,
    validationConfig: existing.validationConfig,
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'screening-template.duplicate',
    entityType: 'ScreeningQuestionTemplate',
    entityId: created.id,
    metadata: { sourceTemplateId: templateId },
    afterData: created,
    ...requestMeta,
  });
  return serializeTemplate(created);
}

export async function listJobScreeningQuestions(actorUser, jobId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const rows = await findJobScreeningQuestions({ organisationId: context.organisationId, jobId });
  return rows.map(serializeQuestion);
}

export async function addJobScreeningQuestion(actorUser, jobId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  await ensureJobForOrganisation(jobId, context.organisationId);
  const nextOrder = await countJobScreeningQuestions({ organisationId: context.organisationId, jobId });
  const normalized = validateQuestionConfiguration({ ...payload, displayOrder: payload.displayOrder ?? nextOrder });
  const created = await createJobScreeningQuestionRecord({
    organisationId: context.organisationId,
    jobId,
    templateId: normalized.templateId,
    createdById: actorUser.id,
    questionText: normalized.questionText,
    internalLabel: normalized.internalLabel,
    helpText: normalized.helpText,
    placeholder: normalized.placeholder,
    questionType: normalized.questionType,
    required: normalized.required,
    displayOrder: normalized.displayOrder,
    isActive: normalized.isActive,
    config: normalized.config,
    validationConfig: normalized.validationConfig,
    rules: normalized.rules,
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job-screening-question.create',
    entityType: 'JobScreeningQuestion',
    entityId: created.id,
    afterData: created,
    ...requestMeta,
  });
  return serializeQuestion(created);
}

export async function addJobQuestionFromLibrary(actorUser, jobId, templateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const template = await ensureTemplate(context.organisationId, templateId);
  return addJobScreeningQuestion(actorUser, jobId, {
    templateId: template.id,
    questionText: template.questionText,
    internalLabel: template.internalLabel,
    helpText: template.helpText,
    placeholder: template.placeholder,
    questionType: template.questionType,
    required: template.isRequiredByDefault,
    isActive: template.isActive,
    config: template.config,
    validationConfig: template.validationConfig,
  }, context.organisationId, requestMeta);
}

export async function updateJobScreeningQuestion(actorUser, jobId, questionId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await findJobScreeningQuestion({ id: questionId, jobId, organisationId: context.organisationId });
  if (!existing) {
    const error = new Error('Screening question not found.');
    error.statusCode = 404;
    throw error;
  }
  const normalized = validateQuestionConfiguration({ ...existing, ...payload });
  const updated = await updateJobScreeningQuestionRecord(questionId, {
    questionText: normalized.questionText,
    internalLabel: normalized.internalLabel,
    helpText: normalized.helpText,
    placeholder: normalized.placeholder,
    questionType: normalized.questionType,
    required: normalized.required,
    displayOrder: normalized.displayOrder,
    isActive: payload.isActive ?? existing.isActive,
    config: normalized.config,
    validationConfig: normalized.validationConfig,
    rules: normalized.rules,
  });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job-screening-question.update',
    entityType: 'JobScreeningQuestion',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ...requestMeta,
  });
  return serializeQuestion(updated);
}

export async function reorderJobScreeningQuestions(actorUser, jobId, questionIds, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const rows = await findJobScreeningQuestionIds({ organisationId: context.organisationId, jobId });
  if (rows.length !== questionIds.length || rows.some((row) => !questionIds.includes(row.id))) {
    const error = new Error('Question order payload is invalid.');
    error.statusCode = 422;
    throw error;
  }
  await reorderJobScreeningQuestionsRecord(questionIds);
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job-screening-question.reorder',
    entityType: 'Job',
    entityId: jobId,
    metadata: { questionIds },
    ...requestMeta,
  });
  return listJobScreeningQuestions(actorUser, jobId, context.organisationId);
}

export async function duplicateJobScreeningQuestion(actorUser, jobId, questionId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const question = await findJobScreeningQuestion({ id: questionId, jobId, organisationId: context.organisationId });
  if (!question) {
    const error = new Error('Screening question not found.');
    error.statusCode = 404;
    throw error;
  }
  return addJobScreeningQuestion(actorUser, jobId, {
    templateId: question.templateId,
    questionText: `${question.questionText} (Copy)`,
    internalLabel: question.internalLabel,
    helpText: question.helpText,
    placeholder: question.placeholder,
    questionType: question.questionType,
    required: question.required,
    isActive: question.isActive,
    config: question.config,
    validationConfig: question.validationConfig,
    rules: question.rules,
  }, context.organisationId, requestMeta);
}

export async function removeJobScreeningQuestion(actorUser, jobId, questionId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const question = await findJobScreeningQuestion({ id: questionId, jobId, organisationId: context.organisationId });
  if (!question) {
    const error = new Error('Screening question not found.');
    error.statusCode = 404;
    throw error;
  }
  await deleteJobScreeningQuestionRecord(questionId);
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job-screening-question.delete',
    entityType: 'JobScreeningQuestion',
    entityId: questionId,
    beforeData: question,
    ...requestMeta,
  });
  return { deleted: true };
}

export async function previewJobQuestions(actorUser, jobId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  await ensureJobForOrganisation(jobId, context.organisationId);
  const questions = await findActiveJobScreeningQuestions({ organisationId: context.organisationId, jobId, isActive: true });
  return questions.map((question) => ({
    id: question.id,
    questionText: question.questionText,
    helpText: question.helpText,
    placeholder: question.placeholder,
    questionType: question.questionType,
    required: question.required,
    config: question.config || {},
    validationConfig: question.validationConfig || {},
  }));
}

export async function listCandidateResumeAssets(candidateUser) {
  const rows = await findCandidateResumeAssetsByCandidate(candidateUser.candidateProfile.id);
  return rows.map(serializeResumeAsset);
}

export async function uploadCandidateResumeAsset(candidateUser, file, { kind = 'RESUME' } = {}) {
  if (!file) {
    const error = new Error('File is required.');
    error.statusCode = 422;
    throw error;
  }
  const extension = getFileExtension(file.originalname);
  const allowedExtensions = kind === 'SCREENING_FILE' ? DEFAULT_ALLOWED_UPLOAD_EXTENSIONS : DEFAULT_ALLOWED_UPLOAD_EXTENSIONS;
  if (!allowedExtensions.includes(extension)) {
    const error = new Error(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}.`);
    error.statusCode = 422;
    throw error;
  }
  const maxBytes = kind === 'SCREENING_FILE' ? ANSWER_FILE_MAX_BYTES : DEFAULT_MAX_FILE_BYTES;
  if ((file.size || file.buffer?.length || 0) > maxBytes) {
    const error = new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`);
    error.statusCode = 422;
    throw error;
  }
  const stored = await storePrivateFile(file, { prefix: kind === 'RESUME' ? 'resumes' : 'screening-files' });
  const parsePreview = { parsingStatus: 'PENDING', parsedData: null };
  const asset = await createResumeAssetRecord({
    candidateId: candidateUser.candidateProfile.id,
    ownerUserId: candidateUser.id,
    kind,
    status: 'ACTIVE',
    source: 'UPLOAD',
    isPrimary: kind === 'RESUME',
    storageKey: stored.storageKey,
    storageProvider: stored.storageProvider,
    originalFilename: stored.originalFilename,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    parsingStatus: parsePreview.parsingStatus,
    parsedData: parsePreview.parsedData,
  });
  if (kind === 'RESUME') {
    await deactivateOtherPrimaryResumes(candidateUser.candidateProfile.id, asset.id);
    await updateCandidateProfileLatestResume(candidateUser.candidateProfile.id, asset.id);
    await markCandidateIntelligenceStale(candidateUser.candidateProfile.id, 'RESUME_ASSET_UPDATED');
    await enqueueBackgroundTask({
      type: 'RESUME_PARSING',
      entityType: 'ResumeAsset',
      entityId: asset.id,
      idempotencyKey: `resume-parse:${asset.id}:${asset.updatedAt.toISOString()}`,
      payload: { assetId: asset.id },
      nextAttemptAt: new Date(),
      createdByUserId: candidateUser.id,
      maxAttempts: 5,
    }).catch(() => {});
    await touchCandidateLastActive(candidateUser.candidateProfile.id);
  }
  return serializeResumeAsset(asset);
}

export async function getPublicJobApplyContext(slug, candidateUser = null) {
  const job = await ensurePublicJob(slug);
  const candidateProfile = candidateUser?.role === 'CANDIDATE'
    ? await findCandidateProfile(candidateUser.candidateProfile.id)
    : null;
  const hasApplied = candidateProfile
    ? Boolean(await findJobApplicationByJobAndCandidate(job.id, candidateProfile.id))
    : false;
  const eligibility = buildEligibility(job, job._count.submittedApplications, hasApplied, candidateProfile);
  return {
    job: {
      id: job.id,
      slug: job.slug,
      title: job.title,
      organisation: job.organisation ? {
        id: job.organisation.id,
        name: job.organisation.name,
        slug: job.organisation.slug,
      } : null,
      visibility: job.visibility,
      applicationOpensAt: iso(job.applicationOpensAt),
      applicationClosesAt: iso(job.applicationClosesAt || job.applicationDeadline),
      maxApplications: job.maxApplications,
      screeningQuestions: job.screeningQuestions
        .filter((question) => question.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((question) => ({
          id: question.id,
          questionText: question.questionText,
          helpText: question.helpText,
          placeholder: question.placeholder,
          questionType: question.questionType,
          required: question.required,
          displayOrder: question.displayOrder,
          config: question.config || {},
          validationConfig: question.validationConfig || {},
        })),
    },
    eligibility,
  };
}

export async function validateApplicationAnswers(candidateUser, payload) {
  const candidateProfile = await findCandidateProfile(candidateUser.candidateProfile.id);
  const job = await findJobForApplicationValidation(payload.jobId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }
  const hasApplied = Boolean(await findJobApplicationByJobAndCandidate(job.id, candidateProfile.id));
  const eligibility = buildEligibility(job, job._count.submittedApplications, hasApplied, candidateProfile);
  if (!eligibility.canApply) {
    const error = new Error(eligibility.reasonCode || 'Application is not available.');
    error.statusCode = 409;
    error.code = eligibility.reasonCode;
    throw error;
  }

  const questionMap = new Map(job.screeningQuestions.map((question) => [question.id, question]));
  const answers = payload.answers || [];
  const seenQuestionIds = new Set();

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      const error = new Error('Submitted answer references an invalid screening question.');
      error.statusCode = 422;
      throw error;
    }
    if (seenQuestionIds.has(answer.questionId)) {
      const error = new Error('Duplicate answer submitted for the same screening question.');
      error.statusCode = 422;
      throw error;
    }
    seenQuestionIds.add(answer.questionId);
    validateAnswerAgainstQuestion(question, answer);
    if (question.questionType === 'FILE_UPLOAD' && answer.fileAssetId) {
      const asset = await ensureAnswerFileAsset(candidateUser.candidateProfile.id, answer.fileAssetId);
      const allowedExtensions = getAllowedFileExtensions(question);
      if (!allowedExtensions.includes(getFileExtension(asset.originalFilename))) {
        throw validationError(question, 'Uploaded file type is not allowed for this question.');
      }
      if (asset.sizeBytes > (question.validationConfig?.maxFileSizeBytes || ANSWER_FILE_MAX_BYTES)) {
        throw validationError(question, 'Uploaded file exceeds the allowed size.');
      }
    }
  }

  for (const question of job.screeningQuestions) {
    if (question.required && !seenQuestionIds.has(question.id)) {
      const error = new Error(`Answer required for "${question.questionText}".`);
      error.statusCode = 422;
      throw error;
    }
  }

  return {
    valid: true,
    questions: job.screeningQuestions,
    eligibility,
  };
}

export async function submitJobApplication(candidateUser, payload, requestMeta = {}) {
  const candidateProfile = await findCandidateProfileWithUser(candidateUser.candidateProfile.id);
  if (!candidateProfile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const validation = await validateApplicationAnswers(candidateUser, payload);
  const resumeAsset = await ensureOwnedResumeAsset(candidateProfile.id, payload.resumeAssetId);
  const source = sanitizeSource(payload.source);
  const answersByQuestionId = new Map((payload.answers || []).map((answer) => [answer.questionId, answer]));

  try {
    const result = await submitJobApplicationRecord({
      payload,
      candidateUserId: candidateUser.id,
      candidateProfile,
      validationQuestions: validation.questions,
      resumeAsset,
      source,
      answersByQuestionId,
      validateAnswerAgainstQuestion,
      evaluateRule,
      generatePublicReference,
    });

    await touchCandidateLastActive(candidateUser.candidateProfile.id);

    await recordAuditLog({
      organisationId: result.jobApplication.organisationId,
      actorUserId: candidateUser.id,
      action: 'application.submit',
      entityType: 'JobApplication',
      entityId: result.jobApplication.id,
      metadata: {
        jobId: payload.jobId,
        publicReference: result.jobApplication.publicReference,
      },
      ...requestMeta,
    });

    const submission = await getCandidateApplicationDetail(candidateUser, result.jobApplication.id);

    const applicationNotificationEmail = submission.job?.applicationNotificationEmail || null;
    if (applicationNotificationEmail) {
      const recruiterName = submission.job?.organisation?.name || 'Recruiter';
      const frontendBaseUrl = process.env.FRONTEND_URL || '';
      const applicationPath = `/recruiter/job-responses?jobId=${encodeURIComponent(submission.job?.id || payload.jobId)}`;
      const applicationUrl = frontendBaseUrl
        ? new URL(applicationPath, frontendBaseUrl).toString()
        : applicationPath;

      await sendRecruiterApplicationNotificationEmail({
        to: applicationNotificationEmail,
        recruiterName,
        candidateName: submission.candidate?.fullName || candidateProfile.fullName || 'A candidate',
        jobTitle: submission.job?.title || 'your job',
        appliedAt: submission.submittedAt,
        applicationUrl,
      }).catch((emailError) => {
        console.error('application.notification.email.failed', {
          code: emailError?.code || null,
          message: emailError?.message || 'Unable to send recruiter application email.',
          applicationId: submission.id,
          jobId: submission.job?.id || payload.jobId,
          organisationId: submission.organisationId || null,
        });
      });
    }

    return submission;
  } catch (error) {
    if (error?.code === 'P2002') {
      const duplicateError = new Error('You have already applied to this job.');
      duplicateError.statusCode = 409;
      duplicateError.code = 'ALREADY_APPLIED';
      throw duplicateError;
    }
    throw error;
  }
}

function serializeJobApplicationDetail(application) {
  const candidateStatus = buildCandidateApplicationStatus(application);
  return {
    id: application.id,
    applicationId: application.applicationId,
    publicReference: application.publicReference,
    submittedAt: iso(application.submittedAt),
    organisationId: application.organisationId,
    source: {
      sourceType: application.sourceType,
      sourceName: application.sourceName,
      sourceCampaign: application.sourceCampaign,
      utmSource: application.utmSource,
      utmMedium: application.utmMedium,
      utmCampaign: application.utmCampaign,
      utmTerm: application.utmTerm,
      utmContent: application.utmContent,
      referrer: application.referrer,
      directLinkIdentifier: application.directLinkIdentifier,
    },
    screeningSummary: application.screeningSummary || {},
    status: candidateStatus.candidateStatusLabel,
    stage: candidateStatus.candidateStatus,
    statusGroup: candidateStatus.candidateStatusGroup,
    canWithdraw: candidateWithdrawalAllowedStages.includes(application.application?.currentStage)
      && !application.withdrawnAt,
    withdrawnAt: iso(application.withdrawnAt),
    withdrawalReason: application.withdrawalReason,
    job: application.job ? {
      id: application.job.id,
      title: application.job.title,
      slug: application.job.slug,
      location: application.job.location,
      employmentType: application.job.employmentType,
      workplaceType: application.job.workplaceType,
      applicationNotificationEmail: application.job.applicationNotificationEmail || null,
      organisation: application.job.organisation ? {
        id: application.job.organisation.id,
        name: application.job.organisation.name,
        slug: application.job.organisation.slug,
      } : null,
    } : null,
    candidate: application.candidate ? {
      id: application.candidate.id,
      fullName: application.candidate.fullName,
      currentTitle: application.candidate.currentTitle,
      headline: application.candidate.headline,
      location: application.candidate.location,
      email: application.candidate.user?.email,
      skills: application.candidate.skills || [],
      totalExperience: application.candidate.totalExperience,
      availability: application.candidate.availability,
      resumeDownloadUrl: application.candidate.resumeUrl || application.candidate.latestResumeAssetId
        ? `/api/resumes/candidate/${application.candidate.id}/download`
        : null,
    } : null,
    resume: application.resumeSnapshot ? {
      id: application.resumeSnapshot.id,
      filename: application.resumeSnapshot.filename,
      mimeType: application.resumeSnapshot.mimeType,
      sizeBytes: application.resumeSnapshot.sizeBytes,
      downloadUrl: `/api/ats/applications/${application.id}/resume`,
    } : null,
    answers: (application.answers || []).map((answer) => ({
      id: answer.id,
      questionId: answer.originalQuestionId,
      questionText: answer.questionTextSnapshot,
      internalLabel: answer.internalLabelSnapshot,
      helpText: answer.helpTextSnapshot,
      placeholder: answer.placeholderSnapshot,
      questionType: answer.questionTypeSnapshot,
      required: answer.requiredSnapshot,
      options: answer.optionsSnapshot?.options || [],
      validation: answer.validationSnapshot || {},
      answerValue: answer.answerValue,
      screeningOutcome: answer.screeningOutcome,
      file: answer.fileAsset ? {
        id: answer.fileAsset.id,
        filename: answer.fileAsset.originalFilename,
        downloadUrl: `/api/ats/files/${answer.fileAsset.id}?applicationId=${application.id}`,
      } : null,
    })),
    flags: (application.flags || []).map((flag) => ({
      id: flag.id,
      questionId: flag.questionId,
      outcome: flag.outcome,
      operator: flag.operator,
      internalReason: flag.internalReason,
      metadata: flag.metadata,
      createdAt: iso(flag.createdAt),
      resolvedAt: iso(flag.resolvedAt),
    })),
    timeline: (application.timeline || []).map(buildCandidateSafeTimelineItem),
    notes: (application.application?.notes || []).map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: iso(note.createdAt),
      author: note.author ? {
        id: note.author.id,
        email: note.author.email,
      } : null,
    })),
    activities: (application.application?.activities || []).map((activity) => ({
      id: activity.id,
      eventType: activity.eventType,
      message: activity.message,
      metadata: activity.metadata,
      createdAt: iso(activity.createdAt),
      actor: activity.actorUser ? {
        id: activity.actorUser.id,
        email: activity.actorUser.email,
        role: activity.actorUser.role,
      } : null,
    })),
    interviewProcesses: (application.application?.interviewProcesses || []).map((process) => ({
      id: process.id,
      title: process.title,
      status: process.status,
      createdAt: iso(process.createdAt),
      rounds: (process.rounds || []).map((round) => ({
        id: round.id,
        roundName: round.roundName,
        sequence: round.sequence,
        interviewType: round.interviewType,
        status: round.status,
        durationMinutes: round.durationMinutes,
        ownerUserId: round.ownerUserId,
        timezone: round.timezone,
        meetingMode: round.meetingMode,
        scheduledStartAt: iso(round.scheduledStartAt),
        scheduledEndAt: iso(round.scheduledEndAt),
        meetingLocation: round.meetingLocation,
        meetingLink: round.meetingLink,
        officeAddress: round.officeAddress,
        candidateInstructions: round.candidateInstructions,
        instructions: round.instructions,
        internalNotes: round.internalNotes,
        cancelReason: round.cancelReason,
        decision: round.decision,
        decisionReason: round.decisionReason,
        completedAt: iso(round.completedAt),
        feedbackLockedAt: iso(round.feedbackLockedAt),
        rescheduleCount: round.rescheduleCount,
        lastRescheduledAt: iso(round.lastRescheduledAt),
        owner: round.owner ? {
          id: round.owner.id,
          email: round.owner.email,
          role: round.owner.role,
        } : null,
        panelMembers: (round.panelMembers || []).map((member) => ({
          id: member.id,
          userId: member.userId,
          isLead: member.isLead,
          isObserver: member.isObserver,
          feedbackRequired: member.feedbackRequired,
          user: member.user ? {
            id: member.user.id,
            email: member.user.email,
            role: member.user.role,
          } : null,
        })),
        feedbacks: (round.feedbacks || []).map((feedback) => ({
          id: feedback.id,
          submittedAt: iso(feedback.submittedAt),
          recommendation: feedback.recommendation,
          overallScore: feedback.overallScore,
          technicalRating: feedback.technicalRating,
          communicationRating: feedback.communicationRating,
          problemSolvingRating: feedback.problemSolvingRating,
          cultureFitRating: feedback.cultureFitRating,
          strengths: feedback.strengths,
          weaknesses: feedback.weaknesses,
          detailedNotes: feedback.detailedNotes,
          comments: feedback.comments,
          finalizedAt: iso(feedback.finalizedAt),
          interviewer: feedback.interviewer ? {
            id: feedback.interviewer.id,
            email: feedback.interviewer.email,
          } : null,
        })),
      })),
    })),
  };
}

export async function listRecruiterJobApplications(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const where = {
    organisationId: context.organisationId,
    jobId: filters.jobId || undefined,
    job: {
      status: filters.jobStatus || undefined,
      recruiterId: filters.recruiterId || undefined,
      title: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    },
    application: {
      statusLabel: filters.status || undefined,
      currentStage: filters.stage || undefined,
    },
    flags: filters.hasFlags ? { some: {} } : undefined,
  };
  const total = await countRecruiterJobApplications(where);
  const page = clampPage(requestedPage, pageSize, total);
  const rows = await findRecruiterJobApplications(
    where,
    { submittedAt: filters.direction === 'asc' ? 'asc' : 'desc' },
    (page - 1) * pageSize,
    pageSize,
  );
  return {
    items: rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      publicReference: row.publicReference,
      candidate: {
        id: row.candidate.id,
        fullName: row.candidate.fullName,
      },
      job: {
        id: row.job.id,
        title: row.job.title,
      },
      submittedAt: iso(row.submittedAt),
      status: row.application?.statusLabel || 'Applied',
      stage: row.application?.currentStage || 'APPLIED',
      screeningSummary: row.screeningSummary || {},
      flagCount: row.flags.length,
      source: {
        sourceType: row.sourceType,
        sourceName: row.sourceName,
      },
      resumeAvailable: Boolean(row.resumeSnapshot),
    })),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getRecruiterJobApplicationDetail(actorUser, jobApplicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const application = await findRecruiterJobApplicationDetail(jobApplicationId, context.organisationId);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }
  return serializeJobApplicationDetail(application);
}

export async function getCandidateApplicationDetail(candidateUser, jobApplicationId) {
  const application = await findCandidateJobApplicationDetail(jobApplicationId, candidateUser.candidateProfile.id);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  const detail = serializeJobApplicationDetail(application);
  return {
    ...detail,
    flags: undefined,
    notes: undefined,
    activities: undefined,
    interviewProcesses: (detail.interviewProcesses || []).map((process) => ({
      ...process,
      rounds: (process.rounds || []).map((round) => ({
        id: round.id,
        roundName: round.roundName,
        sequence: round.sequence,
        interviewType: round.interviewType,
        status: round.status,
        durationMinutes: round.durationMinutes,
        timezone: round.timezone,
        meetingMode: round.meetingMode,
        scheduledStartAt: round.scheduledStartAt,
        scheduledEndAt: round.scheduledEndAt,
        meetingLocation: round.meetingLocation,
        meetingLink: round.meetingLink,
        officeAddress: round.officeAddress,
        candidateInstructions: round.candidateInstructions,
        cancelReason: round.cancelReason,
        decision: round.decision,
        decisionReason: round.decisionReason,
        completedAt: round.completedAt,
        feedbackLockedAt: round.feedbackLockedAt,
        rescheduleCount: round.rescheduleCount,
        lastRescheduledAt: round.lastRescheduledAt,
        panelMembers: (round.panelMembers || []).map((member) => ({
          id: member.id,
          isLead: member.isLead,
          isObserver: member.isObserver,
          user: member.user ? {
            id: member.user.id,
            email: member.user.email,
            role: member.user.role,
          } : null,
        })),
        feedbacks: (round.feedbacks || []).map((feedback) => ({
          id: feedback.id,
          submittedAt: feedback.submittedAt,
          recommendation: feedback.recommendation,
          overallScore: feedback.overallScore,
          interviewer: feedback.interviewer ? {
            id: feedback.interviewer.id,
            email: feedback.interviewer.email,
          } : null,
        })),
      })),
    })),
    answers: (detail.answers || []).map((answer) => ({
      ...answer,
      screeningOutcome: undefined,
      file: answer.file ? { id: answer.file.id, filename: answer.file.filename } : null,
    })),
    resume: detail.resume ? {
      id: detail.resume.id,
      filename: detail.resume.filename,
      mimeType: detail.resume.mimeType,
      sizeBytes: detail.resume.sizeBytes,
    } : null,
  };
}

export async function listCandidateJobApplications(candidateUser, filters = {}) {
  const candidateId = candidateUser.candidateProfile.id;
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const filter = String(filters.filter || 'ALL').toUpperCase();
  const where = {
    candidateId,
    ...(filter === 'ACTIVE' ? { application: { currentStage: { in: ['APPLIED', 'SHORTLISTED'] } } } : {}),
    ...(filter === 'INTERVIEW' ? { application: { currentStage: { in: ['INTERVIEW_SCHEDULED'] } } } : {}),
    ...(filter === 'OFFER' ? { application: { statusLabel: { in: Object.keys(candidateStatusLabelMap).filter((label) => candidateStatusLabelMap[label].group === 'OFFER') } } } : {}),
    ...(filter === 'CLOSED' ? { application: { OR: [{ currentStage: { in: ['SELECTED', 'REJECTED'] } }, { statusLabel: { in: Object.keys(candidateStatusLabelMap).filter((label) => candidateStatusLabelMap[label].group === 'CLOSED') } }] } } : {}),
    ...(filter === 'WITHDRAWN' ? { application: { currentStage: 'WITHDRAWN' } } : {}),
  };
  const orderBy = (() => {
    switch (String(filters.sort || 'recently_updated')) {
      case 'recently_applied':
        return [{ submittedAt: 'desc' }, { id: 'asc' }];
      case 'oldest':
        return [{ submittedAt: 'asc' }, { id: 'asc' }];
      case 'job_title':
        return [{ job: { title: 'asc' } }, { submittedAt: 'desc' }];
      case 'recently_updated':
      default:
        return [{ updatedAt: 'desc' }, { submittedAt: 'desc' }];
    }
  })();

  const total = await countCandidateJobApplications(where);
  const page = clampPage(requestedPage, pageSize, total);
  const rows = await findCandidateJobApplications(where, orderBy, (page - 1) * pageSize, pageSize);
  return {
    items: rows.map((row) => {
      const candidateStatus = buildCandidateApplicationStatus(row);
      return {
        id: row.id,
        publicReference: row.publicReference,
        submittedAt: iso(row.submittedAt),
        updatedAt: iso(row.updatedAt),
        status: candidateStatus.candidateStatusLabel,
        stage: candidateStatus.candidateStatus,
        statusGroup: candidateStatus.candidateStatusGroup,
        canWithdraw: candidateWithdrawalAllowedStages.includes(row.application?.currentStage) && !row.withdrawnAt,
        job: row.job ? {
          id: row.job.id,
          title: row.job.title,
          slug: row.job.slug,
          location: row.job.location,
          employmentType: row.job.employmentType,
          workplaceType: row.job.workplaceType,
          organisation: row.job.organisation ? {
            name: row.job.organisation.name,
            slug: row.job.organisation.slug,
          } : null,
        } : null,
        resume: row.resumeSnapshot ? {
          filename: row.resumeSnapshot.filename,
        } : null,
        timeline: row.timeline.map(buildCandidateSafeTimelineItem),
        latestUpdate: row.timeline[0]?.message || null,
      };
    }),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getCandidateApplicationWithdrawalEligibility(candidateUser, jobApplicationId) {
  const application = await findCandidateWithdrawalApplication(jobApplicationId, candidateUser.candidateProfile.id);

  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  const canWithdraw = candidateWithdrawalAllowedStages.includes(application.application?.currentStage)
    && !application.withdrawnAt;

  return {
    canWithdraw,
    reasonCode: canWithdraw ? null : application.withdrawnAt ? 'ALREADY_WITHDRAWN' : 'STATUS_NOT_WITHDRAWABLE',
    status: buildCandidateApplicationStatus(application).candidateStatusLabel,
  };
}

export async function withdrawCandidateApplication(candidateUser, jobApplicationId, payload = {}, requestMeta = {}) {
  const existing = await findCandidateWithdrawalApplication(jobApplicationId, candidateUser.candidateProfile.id);

  if (!existing) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  if (existing.withdrawnAt) {
    const error = new Error('This application has already been withdrawn.');
    error.statusCode = 409;
    throw error;
  }

  if (!candidateWithdrawalAllowedStages.includes(existing.application?.currentStage)) {
    const error = new Error('This application can no longer be withdrawn.');
    error.statusCode = 422;
    throw error;
  }

  await withdrawCandidateApplicationRecord({
    existing,
    candidateUserId: candidateUser.id,
    timelineMessage: getCandidateTimelineMessage('WITHDRAWN', existing.job.title),
    reason: payload.reason || null,
    note: payload.note || null,
  });

  await recordAuditLog({
    organisationId: existing.organisationId,
    actorUserId: candidateUser.id,
    action: 'application.withdraw',
    entityType: 'JobApplication',
    entityId: existing.id,
    metadata: {
      reason: payload.reason || null,
    },
    ...requestMeta,
  });

  return getCandidateApplicationDetail(candidateUser, jobApplicationId);
}

export async function updateCandidateResumeAssetState(candidateUser, assetId, action, requestMeta = {}) {
  const asset = await ensureOwnedResumeAsset(candidateUser.candidateProfile.id, assetId);

  if (action === 'SET_PRIMARY') {
    await setPrimaryResumeAssetRecord(candidateUser.candidateProfile.id, asset.id);
  } else if (action === 'ARCHIVE') {
    if (asset.isPrimary) {
      const replacement = await findActiveReplacementResume(candidateUser.candidateProfile.id, asset.id);
      if (!replacement) {
        const error = new Error('Upload another resume before archiving your primary resume.');
        error.statusCode = 409;
        throw error;
      }
      await markResumeAssetPrimary(replacement.id);
      await updateCandidateProfileResumeLink(candidateUser.candidateProfile.id, replacement.id);
    }

    await archiveResumeAssetRecord(asset.id);
  } else if (action === 'DELETE') {
    const applicationReferences = await countApplicationResumeSnapshotReferences(asset.id);
    if (applicationReferences > 0) {
      const error = new Error('This resume is referenced by an application snapshot and cannot be deleted.');
      error.statusCode = 409;
      throw error;
    }
    if (asset.isPrimary) {
      const replacement = await findActiveReplacementResume(candidateUser.candidateProfile.id, asset.id);
      await updateCandidateProfileResumeLink(candidateUser.candidateProfile.id, replacement?.id || null);
      if (replacement) {
        await markResumeAssetPrimary(replacement.id);
      }
    }

    await deleteResumeAssetRecord(asset.id);
  } else if (action === 'RESTORE') {
    await restoreResumeAssetRecord(asset.id);
  } else if (action === 'RETRY_PARSE') {
    console.log(JSON.stringify({
      level: 'info',
      event: 'resume.parse.retry.requested',
      assetId: asset.id,
      candidateId: candidateUser.candidateProfile.id,
      actorUserId: candidateUser.id,
    }));

    const activeTask = await prisma.backgroundTask.findFirst({
      where: {
        type: 'RESUME_PARSING',
        entityId: asset.id,
        status: { in: ['PENDING', 'RETRY_SCHEDULED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeTask) {
      console.log(JSON.stringify({
        level: 'info',
        event: 'resume.parse.task.already-active',
        taskId: activeTask.id,
        assetId: asset.id,
        candidateId: candidateUser.candidateProfile.id,
      }));
      return listCandidateResumeAssets(candidateUser);
    }

    await updateResumeAssetParsing(asset.id, 'PENDING', null);
    const task = await enqueueBackgroundTask({
      type: 'RESUME_PARSING',
      entityType: 'ResumeAsset',
      entityId: asset.id,
      idempotencyKey: `resume-parse:${asset.id}:retry:${Date.now()}`,
      payload: { assetId: asset.id },
      nextAttemptAt: new Date(),
      createdByUserId: candidateUser.id,
      maxAttempts: 5,
    }).catch(() => {});

    console.log(JSON.stringify({
      level: 'info',
      event: 'resume.parse.task.enqueued',
      taskId: task?.id || null,
      assetId: asset.id,
      candidateId: candidateUser.candidateProfile.id,
      status: 'PENDING',
    }));
  }

  await recordAuditLog({
    actorUserId: candidateUser.id,
    action: `candidate.resume.${action.toLowerCase()}`,
    entityType: 'ResumeAsset',
    entityId: asset.id,
    metadata: {
      candidateId: candidateUser.candidateProfile.id,
      action,
    },
    ...requestMeta,
  });

  return listCandidateResumeAssets(candidateUser);
}

export async function applyCandidateResumeParsedUpdates(candidateUser, assetId, payload = {}, requestMeta = {}) {
  const asset = await ensureOwnedResumeAsset(candidateUser.candidateProfile.id, assetId);
  const suggestedUpdates = asset.parsedData?.suggestedUpdates || {};
  const dismiss = payload.dismiss === true;
  const fields = payload.acceptAll
    ? Object.keys(suggestedUpdates)
    : Array.isArray(payload.fields)
      ? payload.fields
      : [];

  const updateData = {};
  const nextSuggestedUpdates = { ...suggestedUpdates };
  const acceptedFields = Array.isArray(asset.parsedData?.acceptedFields) ? [...asset.parsedData.acceptedFields] : [];
  const dismissedFields = Array.isArray(asset.parsedData?.dismissedFields) ? [...asset.parsedData.dismissedFields] : [];

  for (const field of fields) {
    if (!suggestedUpdates[field]) continue;
    if (dismiss) {
      delete nextSuggestedUpdates[field];
      if (!dismissedFields.includes(field)) dismissedFields.push(field);
      continue;
    }

    const suggestion = suggestedUpdates[field];
    const resumeValue = typeof suggestion === 'object' && suggestion !== null && 'resumeValue' in suggestion
      ? suggestion.resumeValue
      : suggestion;

    if (field === 'skills' && Array.isArray(resumeValue)) {
      updateData.skills = [...new Set([...(candidateUser.candidateProfile.skills || []), ...resumeValue])];
    } else if ([
      'currentTitle',
      'currentEmployer',
      'currentDesignation',
      'location',
      'headline',
      'summary',
      'phoneNumber',
    ].includes(field) && resumeValue) {
      updateData[field] = resumeValue;
    }

    delete nextSuggestedUpdates[field];
    if (!acceptedFields.includes(field)) acceptedFields.push(field);
  }

  if (Object.keys(updateData).length) {
    await updateCandidateProfileRecord(candidateUser.candidateProfile.id, updateData);
  }

  await updateResumeAssetParsedReview(
    asset.id,
    {
      ...(asset.parsedData || {}),
      suggestedUpdates: nextSuggestedUpdates,
      acceptedFields,
      dismissedFields,
      lastReviewedAt: new Date().toISOString(),
    },
    Object.keys(nextSuggestedUpdates).length ? 'PARTIAL' : asset.parsingStatus,
  );

  await recordAuditLog({
    actorUserId: candidateUser.id,
    action: 'candidate.resume.apply-parsed-updates',
    entityType: 'ResumeAsset',
    entityId: asset.id,
    metadata: {
      candidateId: candidateUser.candidateProfile.id,
      fields,
      dismiss,
    },
    ...requestMeta,
  });

  return {
    resumes: await listCandidateResumeAssets(candidateUser),
  };
}

export async function getOwnedResumeDownload(candidateUser, assetId) {
  const asset = await findOwnedDownloadResumeAsset(assetId, candidateUser.candidateProfile.id);
  if (!asset) {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }
  return {
    asset,
    file: readPrivateFileNodeStream(asset.storageProvider, asset.storageKey),
  };
}

export async function getRecruiterApplicationResumeDownload(actorUser, jobApplicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const snapshot = await findApplicationResumeSnapshot(jobApplicationId, context.organisationId);
  if (!snapshot) {
    const error = new Error('Resume snapshot not found.');
    error.statusCode = 404;
    throw error;
  }
  return {
    snapshot,
    file: readPrivateFileNodeStream(snapshot.storageProvider, snapshot.storageKey),
  };
}

export async function getRecruiterAnswerFileDownload(actorUser, assetId, jobApplicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const answer = await findApplicationScreeningAnswerFile(jobApplicationId, context.organisationId, assetId);
  if (!answer?.fileAsset) {
    const error = new Error('Uploaded file not found.');
    error.statusCode = 404;
    throw error;
  }
  return {
    asset: answer.fileAsset,
    file: readPrivateFileNodeStream(answer.fileAsset.storageProvider, answer.fileAsset.storageKey),
  };
}
