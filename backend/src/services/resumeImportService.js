import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import {
  createPrivateDownloadUrl,
  readPrivateFileNodeStream,
  storePrivateFile,
} from '../config/storage.js';
import { requireOrganisationRole } from './organisationAccessService.js';
import { enqueueBackgroundTask, renewTaskLease } from './backgroundTaskService.js';
import { recordAuditLog } from './auditLogService.js';
import {
  expandResumeArchive,
  extractResumeText,
  getExtension,
  hasMinimumIdentity,
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizePhone,
  sanitizeResumeData,
  sanitizeResumeString,
  validateUploadedResumeFile,
} from './resumeImportUtils.js';
import { parseResumeText } from './ai/resume-parser.js';
import { env } from '../config/env.js';
import { markCandidateIntelligenceStale } from '../intelligence/services/candidateIntelligenceService.js';
import { enqueueResumeSearchIndexUpsert } from './resumeSearchV2/indexingService.js';
import {
  buildResumeImportDocumentProcessorResult,
  shouldUseDocumentProcessorForImportItem,
} from './documentProcessor/resumeImportDocumentProcessorIntegration.js';

const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
const readableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'VIEWER'];
const RETRYABLE_ITEM_STATUSES = new Set(['FAILED', 'REVIEW_REQUIRED', 'DUPLICATE']);
const TERMINAL_ITEM_STATUSES = new Set(['REVIEW_REQUIRED', 'DUPLICATE', 'READY', 'IMPORTED', 'FAILED', 'CANCELLED']);
function buildError(message, statusCode = 422, code = 'RESUME_IMPORT_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function isResumeImportBatchBlocked(batchId) {
  return Boolean(batchId) && env.resumeImportBlockedBatchIds.includes(batchId);
}

export function buildBlockedResumeImportBatchReason(batchId) {
  return `Resume import processing skipped because batch ${batchId} is blocked by configuration.`;
}

export function isResumeImportDocumentProcessorAllowed(item) {
  return shouldUseDocumentProcessorForImportItem(item);
}

async function enqueueResumeSearchIndexUpsertBestEffort(candidateId, options = {}) {
  if (!candidateId) return;
  await enqueueResumeSearchIndexUpsert(candidateId, options).catch(() => {});
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function summarizeItemDuration(item) {
  if (!item.processingStartedAt || !item.processingCompletedAt) return null;
  return Math.max(0, item.processingCompletedAt.getTime() - item.processingStartedAt.getTime());
}

function serializeBatch(batch) {
  const durationMs = batch.startedAt && batch.completedAt
    ? Math.max(0, batch.completedAt.getTime() - batch.startedAt.getTime())
    : null;
  return {
    id: batch.id,
    organisationId: batch.organisationId,
    createdByUserId: batch.createdByUserId,
    originalFileCount: batch.originalFileCount,
    totalItemCount: batch.totalItemCount,
    processedCount: batch.processedCount,
    successCount: batch.successCount,
    duplicateCount: batch.duplicateCount,
    reviewCount: batch.reviewCount,
    failedCount: batch.failedCount,
    status: batch.status,
    startedAt: iso(batch.startedAt),
    completedAt: iso(batch.completedAt),
    durationMs,
    createdAt: iso(batch.createdAt),
    updatedAt: iso(batch.updatedAt),
  };
}

function serializeItem(item) {
  return {
    id: item.id,
    batchId: item.batchId,
    organisationId: item.organisationId,
    originalFilename: item.originalFilename,
    sanitizedFilename: item.sanitizedFilename,
    mimeType: item.mimeType,
    fileExtension: item.fileExtension,
    fileSizeBytes: item.fileSizeBytes,
    status: item.status,
    parsedData: sanitizeResumeData(item.parsedData || null),
    parserVersion: item.parserVersion || null,
    parsingConfidence: sanitizeResumeData(item.parsingConfidence || null),
    duplicateCandidateId: item.duplicateCandidateId || null,
    duplicateReason: item.duplicateReason || null,
    duplicateMatchFields: item.duplicateMatchFields || null,
    duplicateResolution: item.duplicateResolution,
    candidateId: item.candidateId || null,
    errorCode: item.errorCode || null,
    errorMessage: item.errorMessage || null,
    retryCount: item.retryCount,
    requiresManualReview: item.requiresManualReview,
    reviewNotes: item.reviewNotes || null,
    processingStartedAt: iso(item.processingStartedAt),
    processingCompletedAt: iso(item.processingCompletedAt),
    durationMs: summarizeItemDuration(item),
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
  };
}

function mergeCandidateValue(parsedData, field, fallback = null) {
  return parsedData?.candidate?.[field]?.value ?? fallback;
}

function mergeCandidateConfidence(parsedData, field, fallback = 0) {
  return parsedData?.candidate?.[field]?.confidence ?? fallback;
}

function buildParsedDataPatch(currentParsedData, payload) {
  const next = sanitizeResumeData(structuredClone(currentParsedData || {}));
  next.candidate ||= {};

  const fieldMap = {
    fullName: 'fullName',
    email: 'email',
    phoneNumber: 'phoneNumber',
    linkedInUrl: 'linkedInUrl',
    currentTitle: 'currentTitle',
    currentEmployer: 'currentEmployer',
    location: 'location',
    summary: 'summary',
  };

  for (const [payloadField, candidateField] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(payload, payloadField)) {
      next.candidate[candidateField] = {
        value: payload[payloadField] || null,
        confidence: 1,
        source: 'manual_review',
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'skills')) {
    next.candidate.skills = {
      value: payload.skills || [],
      confidence: 1,
      source: 'manual_review',
    };
  }

  return next;
}

async function expandUploadedFiles(files) {
  const expandedFiles = [];
  for (const file of files) {
    const validated = await validateUploadedResumeFile(file);
    if (validated.extension === '.zip') {
      const entries = await expandResumeArchive(file);
      expandedFiles.push(...entries);
      continue;
    }
    expandedFiles.push({
      ...file,
      extension: validated.extension,
      sanitizedFilename: validated.sanitizedFilename,
    });
  }

  if (!expandedFiles.length) {
    throw buildError('No supported resume files were found in the upload.', 422, 'EMPTY_IMPORT');
  }
  if (expandedFiles.length > env.resumeImportMaxFiles) {
    throw buildError(`Resume import exceeds the ${env.resumeImportMaxFiles} file limit.`, 422, 'IMPORT_FILE_LIMIT');
  }

  const uniqueKeys = new Set();
  for (const file of expandedFiles) {
    const key = `${file.sanitizedFilename}:${file.size}`;
    if (uniqueKeys.has(key)) {
      throw buildError(`Duplicate file detected in the same batch: ${file.originalname}.`, 422, 'DUPLICATE_BATCH_FILE');
    }
    uniqueKeys.add(key);
  }

  return expandedFiles;
}

async function refreshBatchCounts(batchId, tx = prisma) {
  const items = await tx.resumeImportItem.findMany({
    where: { batchId },
    select: { status: true },
  });

  const counts = items.reduce((acc, item) => {
    acc.total += 1;
    if (TERMINAL_ITEM_STATUSES.has(item.status)) acc.processed += 1;
    if (item.status === 'IMPORTED') acc.success += 1;
    if (item.status === 'DUPLICATE') acc.duplicate += 1;
    if (item.status === 'REVIEW_REQUIRED' || item.status === 'READY') acc.review += 1;
    if (item.status === 'FAILED') acc.failed += 1;
    return acc;
  }, { total: 0, processed: 0, success: 0, duplicate: 0, review: 0, failed: 0 });

  const status = counts.processed < counts.total
    ? 'PROCESSING'
    : counts.failed === counts.total
      ? 'FAILED'
      : counts.failed > 0 || counts.review > 0 || counts.duplicate > 0
        ? 'PARTIAL'
        : 'COMPLETED';

  return tx.resumeImportBatch.update({
    where: { id: batchId },
    data: {
      totalItemCount: counts.total,
      processedCount: counts.processed,
      successCount: counts.success,
      duplicateCount: counts.duplicate,
      reviewCount: counts.review,
      failedCount: counts.failed,
      status,
      completedAt: counts.processed === counts.total ? new Date() : null,
      startedAt: counts.total ? (await tx.resumeImportBatch.findUnique({ where: { id: batchId }, select: { startedAt: true } }))?.startedAt || new Date() : null,
    },
  });
}

function buildCandidateDataFromParsed(item, overrides = {}) {
  const parsedData = sanitizeResumeData(buildParsedDataPatch(item.parsedData, overrides));
  return sanitizeResumeData({
    fullName: overrides.fullName || mergeCandidateValue(parsedData, 'fullName', item.sanitizedFilename.replace(getExtension(item.sanitizedFilename), '')),
    email: normalizeEmail(overrides.email ?? mergeCandidateValue(parsedData, 'email')),
    phoneNumber: overrides.phoneNumber ?? mergeCandidateValue(parsedData, 'phoneNumber'),
    normalizedPhoneNumber: normalizePhone(overrides.phoneNumber ?? mergeCandidateValue(parsedData, 'phoneNumber')),
    linkedInUrl: overrides.linkedInUrl ?? mergeCandidateValue(parsedData, 'linkedInUrl'),
    linkedInUrlNormalized: normalizeLinkedInUrl(overrides.linkedInUrl ?? mergeCandidateValue(parsedData, 'linkedInUrl')),
    currentTitle: overrides.currentTitle ?? mergeCandidateValue(parsedData, 'currentTitle'),
    currentEmployer: overrides.currentEmployer ?? mergeCandidateValue(parsedData, 'currentEmployer'),
    currentDesignation: overrides.currentDesignation ?? mergeCandidateValue(parsedData, 'currentTitle'),
    location: overrides.location ?? mergeCandidateValue(parsedData, 'location'),
    currentCity: overrides.currentCity || null,
    currentState: overrides.currentState || null,
    currentCountry: overrides.currentCountry || null,
    postalCode: overrides.postalCode || null,
    summary: overrides.summary ?? mergeCandidateValue(parsedData, 'summary'),
    totalExperience: overrides.totalExperience ?? 0,
    skills: overrides.skills ?? mergeCandidateValue(parsedData, 'skills', []),
    functionalSkills: overrides.functionalSkills ?? [],
    tools: overrides.tools ?? [],
    frameworks: overrides.frameworks ?? [],
    cloudPlatforms: overrides.cloudPlatforms ?? [],
    databases: overrides.databases ?? [],
    softSkills: overrides.softSkills ?? [],
    experienceEntries: overrides.experienceEntries ?? [],
    educationEntries: overrides.educationEntries ?? [],
    certificationEntries: overrides.certificationEntries ?? [],
    languageEntries: overrides.languageEntries ?? [],
    projectEntries: overrides.projectEntries ?? [],
    rawResumeText: sanitizeResumeString(item.extractedText || null),
    parserVersion: item.parserVersion || parsedData?.metadata?.parser || null,
    parserMetadata: {
      parsedData,
      confidence: {
        fullName: mergeCandidateConfidence(parsedData, 'fullName'),
        email: mergeCandidateConfidence(parsedData, 'email'),
        phoneNumber: mergeCandidateConfidence(parsedData, 'phoneNumber'),
        linkedInUrl: mergeCandidateConfidence(parsedData, 'linkedInUrl'),
      },
      sourceItemId: item.id,
      ...(overrides.parserMetadata || {}),
    },
    provenanceMetadata: {
      importBatchId: item.batchId,
      originalFilename: item.originalFilename,
      checksumSha256: item.checksumSha256,
      ...(overrides.provenanceMetadata || {}),
    },
    consentMetadata: item.metadata?.consentMetadata || null,
  });
}

function hasMinimumCandidateIdentity(candidateData) {
  return Boolean(candidateData.fullName && (candidateData.email || candidateData.normalizedPhoneNumber || candidateData.linkedInUrlNormalized));
}

async function detectDuplicateCandidate(organisationId, parsedData, tx = prisma, excludeCandidateId = null) {
  const email = normalizeEmail(parsedData?.candidate?.email?.value);
  const phone = normalizePhone(parsedData?.candidate?.phoneNumber?.value);
  const linkedInUrl = normalizeLinkedInUrl(parsedData?.candidate?.linkedInUrl?.value);
  const fullName = mergeCandidateValue(parsedData, 'fullName');
  const currentEmployer = mergeCandidateValue(parsedData, 'currentEmployer');

  const exactOr = [
    email ? { email } : null,
    phone ? { normalizedPhoneNumber: phone } : null,
    linkedInUrl ? { linkedInUrlNormalized: linkedInUrl } : null,
  ].filter(Boolean);

  if (exactOr.length) {
    const candidate = await tx.candidateProfile.findFirst({
      where: {
        organisationId,
        ...(excludeCandidateId ? { id: { not: excludeCandidateId } } : {}),
        OR: exactOr,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (candidate) {
      let reason = 'matched existing candidate';
      let matchFields = [];
      if (email && candidate.email === email) {
        reason = 'email';
        matchFields.push('email');
      }
      if (phone && candidate.normalizedPhoneNumber === phone) {
        reason = reason === 'matched existing candidate' ? 'phone' : reason;
        matchFields.push('phoneNumber');
      }
      if (linkedInUrl && candidate.linkedInUrlNormalized === linkedInUrl) {
        reason = reason === 'matched existing candidate' ? 'linkedin' : reason;
        matchFields.push('linkedInUrl');
      }
      return { candidate, reason, matchFields, suggestedOnly: false };
    }
  }

  if (fullName && currentEmployer) {
    const suggestion = await tx.candidateProfile.findFirst({
      where: {
        organisationId,
        ...(excludeCandidateId ? { id: { not: excludeCandidateId } } : {}),
        fullName: { equals: fullName, mode: 'insensitive' },
        currentEmployer: { equals: currentEmployer, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (suggestion) {
      return {
        candidate: suggestion,
        reason: 'name_and_employer_similarity',
        matchFields: ['fullName', 'currentEmployer'],
        suggestedOnly: true,
      };
    }
  }

  return null;
}

async function createCandidateResumeAsset(tx, candidateId, ownerUserId, item, parsedData = null) {
  const asset = await tx.resumeAsset.create({
    data: {
      candidateId,
      ownerUserId,
      kind: 'RESUME',
      status: 'ACTIVE',
      source: 'UPLOAD',
      isPrimary: true,
      storageKey: item.storedObjectKey,
      storageProvider: item.storageProvider,
      originalFilename: item.originalFilename,
      mimeType: item.mimeType,
      sizeBytes: item.fileSizeBytes,
      parsingStatus: item.errorCode ? 'PARTIAL' : 'COMPLETED',
      parsedText: sanitizeResumeString(item.extractedText || null),
      parsedData: sanitizeResumeData(parsedData || item.parsedData || null),
    },
  });

  await tx.resumeAsset.updateMany({
    where: {
      candidateId,
      kind: 'RESUME',
      id: { not: asset.id },
    },
    data: { isPrimary: false },
  });

  return asset;
}

async function createImportedCandidate(tx, item, actorUserId, overrides = {}) {
  const candidateData = buildCandidateDataFromParsed(item, overrides);
  const hasMinimumIdentityFields = hasMinimumCandidateIdentity(candidateData);
  const profileStatus = hasMinimumIdentityFields ? 'IMPORTED' : 'REVIEW_REQUIRED';

  const candidate = await tx.candidateProfile.create({
    data: {
      organisationId: item.organisationId,
      importBatchId: item.batchId,
      importedByUserId: actorUserId,
      source: 'BULK_IMPORT',
      profileStatus,
      searchableProfile: hasMinimumIdentityFields,
      profileVisibility: 'RECRUITERS_ONLY',
      importedAt: new Date(),
      fullName: candidateData.fullName,
      email: candidateData.email,
      phoneNumber: candidateData.phoneNumber,
      normalizedPhoneNumber: candidateData.normalizedPhoneNumber,
      currentTitle: candidateData.currentTitle,
      currentEmployer: candidateData.currentEmployer,
      currentDesignation: candidateData.currentDesignation,
      location: candidateData.location,
      currentCity: candidateData.currentCity,
      currentState: candidateData.currentState,
      currentCountry: candidateData.currentCountry,
      postalCode: candidateData.postalCode,
      summary: candidateData.summary,
      totalExperience: candidateData.totalExperience,
      linkedInUrl: candidateData.linkedInUrl,
      linkedInUrlNormalized: candidateData.linkedInUrlNormalized,
      skills: candidateData.skills || [],
      functionalSkills: candidateData.functionalSkills || [],
      tools: candidateData.tools || [],
      frameworks: candidateData.frameworks || [],
      cloudPlatforms: candidateData.cloudPlatforms || [],
      databases: candidateData.databases || [],
      softSkills: candidateData.softSkills || [],
      experienceEntries: candidateData.experienceEntries || [],
      educationEntries: candidateData.educationEntries || [],
      certificationEntries: candidateData.certificationEntries || [],
      languageEntries: candidateData.languageEntries || [],
      projectEntries: candidateData.projectEntries || [],
      rawResumeText: candidateData.rawResumeText,
      parserVersion: candidateData.parserVersion,
      parserMetadata: candidateData.parserMetadata,
      provenanceMetadata: candidateData.provenanceMetadata,
      consentMetadata: candidateData.consentMetadata,
    },
  });

  const asset = await createCandidateResumeAsset(tx, candidate.id, actorUserId, item);
  const updatedCandidate = await tx.candidateProfile.update({
    where: { id: candidate.id },
    data: {
      latestResumeAssetId: asset.id,
      resumeUrl: `/api/resumes/candidate/${candidate.id}/download`,
    },
  });

  return { candidate: updatedCandidate, asset, profileStatus };
}

async function attachResumeToExistingCandidate(tx, existingCandidateId, actorUserId, item) {
  const asset = await createCandidateResumeAsset(tx, existingCandidateId, actorUserId, item);
  const candidate = await tx.candidateProfile.update({
    where: { id: existingCandidateId },
    data: {
      latestResumeAssetId: asset.id,
      resumeUrl: `/api/resumes/candidate/${existingCandidateId}/download`,
      updatedAt: new Date(),
    },
  });
  return { candidate, asset };
}

async function ensureReadableBatch(actorUser, batchId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const batch = await prisma.resumeImportBatch.findFirst({
    where: { id: batchId, organisationId: context.organisationId },
  });
  if (!batch) {
    throw buildError('Resume import batch not found.', 404, 'BATCH_NOT_FOUND');
  }
  return { context, batch };
}

async function ensureWritableItem(actorUser, batchId, itemId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const item = await prisma.resumeImportItem.findFirst({
    where: { id: itemId, batchId, organisationId: context.organisationId },
  });
  if (!item) {
    throw buildError('Resume import item not found.', 404, 'ITEM_NOT_FOUND');
  }
  return { context, item };
}

const ACTIVE_BACKGROUND_TASK_STATUSES = ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'];

/**
 * At most one non-terminal RESUME_IMPORT_PROCESSING task may exist for a
 * given item at any time. Repeated (non-forced) enqueue calls reuse that
 * active task instead of creating a new one. A forced retry may only
 * supersede an active task that is not currently under an unexpired lease
 * (i.e. not genuinely in flight) — superseding a live RUNNING task would
 * risk two workers processing the same item concurrently and, further
 * downstream, duplicate CandidateProfile creation.
 */
export async function enqueueItemProcessing(item, actorUserId, force = false) {
  const activeTask = await prisma.backgroundTask.findFirst({
    where: {
      entityType: 'ResumeImportItem',
      entityId: item.id,
      status: { in: ACTIVE_BACKGROUND_TASK_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeTask) {
    const leaseActive = activeTask.status === 'RUNNING'
      && activeTask.leaseExpiresAt
      && new Date(activeTask.leaseExpiresAt) > new Date();

    if (!force) {
      return activeTask;
    }

    if (leaseActive) {
      throw buildError(
        'This item is currently being processed by an active worker and cannot be retried yet.',
        409,
        'ITEM_PROCESSING_IN_PROGRESS',
      );
    }

    await prisma.backgroundTask.updateMany({
      where: { id: activeTask.id, status: activeTask.status },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        leaseOwnerId: null,
        leaseExpiresAt: null,
        lastErrorCode: 'SUPERSEDED_BY_RETRY',
        lastErrorMessage: 'Superseded by a new retry request for the same item.',
      },
    });
  }

  return enqueueBackgroundTask({
    organisationId: item.organisationId,
    type: 'RESUME_IMPORT_PROCESSING',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    idempotencyKey: `resume-import-item:${item.id}:gen:${item.retryCount}:${force ? 'forced' : 'auto'}`,
    payload: { batchId: item.batchId, itemId: item.id, force },
    nextAttemptAt: new Date(),
    createdByUserId: actorUserId,
    maxAttempts: env.resumeImportMaxRetries + 1,
  });
}

export async function createResumeImportBatch(actorUser, files, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  if (!files?.length) {
    throw buildError('At least one file is required.', 422, 'MISSING_FILES');
  }

  const expandedFiles = await expandUploadedFiles(files);
  const batch = await prisma.resumeImportBatch.create({
    data: {
      organisationId: context.organisationId,
      createdByUserId: actorUser.id,
      originalFileCount: files.length,
      totalItemCount: expandedFiles.length,
      status: 'UPLOADING',
    },
  });

  for (const file of expandedFiles) {
    const stored = await storePrivateFile(file, {
      prefix: `resumes/${context.organisationId}/${batch.id}`,
      metadata: { batchId: batch.id, organisationId: context.organisationId },
    });

    const item = await prisma.resumeImportItem.create({
      data: {
        batchId: batch.id,
        organisationId: context.organisationId,
        originalFilename: file.originalname,
        sanitizedFilename: file.sanitizedFilename,
        storedObjectKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        mimeType: stored.mimeType,
        fileExtension: file.extension,
        fileSizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        status: 'UPLOADED',
      },
    });

    await enqueueItemProcessing(item, actorUser.id);
  }

  const updated = await prisma.resumeImportBatch.update({
    where: { id: batch.id },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.batch.created',
    entityType: 'ResumeImportBatch',
    entityId: batch.id,
    metadata: {
      originalFileCount: files.length,
      totalItemCount: expandedFiles.length,
    },
    ...requestMeta,
  });

  return serializeBatch(updated);
}

export async function listResumeImportBatches(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 20)));
  const orderField = ['createdAt', 'updatedAt', 'completedAt'].includes(filters.sort) ? filters.sort : 'createdAt';
  const direction = filters.direction === 'asc' ? 'asc' : 'desc';
  const where = {
    organisationId: context.organisationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.createdByUserId ? { createdByUserId: filters.createdByUserId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.resumeImportBatch.findMany({
      where,
      orderBy: { [orderField]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.resumeImportBatch.count({ where }),
  ]);

  return {
    items: items.map(serializeBatch),
    meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
  };
}

export async function getResumeImportBatch(actorUser, batchId, organisationId = null) {
  const { batch } = await ensureReadableBatch(actorUser, batchId, organisationId);
  return serializeBatch(batch);
}

export async function listResumeImportItems(actorUser, batchId, filters = {}, organisationId = null) {
  const { context } = await ensureReadableBatch(actorUser, batchId, organisationId);
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 20)));
  const orderField = ['createdAt', 'updatedAt', 'processingCompletedAt'].includes(filters.sort) ? filters.sort : 'createdAt';
  const direction = filters.direction === 'asc' ? 'asc' : 'desc';
  const where = {
    batchId,
    organisationId: context.organisationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.reviewOnly ? { requiresManualReview: true } : {}),
    ...(filters.duplicateOnly ? { status: 'DUPLICATE' } : {}),
    ...(filters.failedOnly ? { status: 'FAILED' } : {}),
    ...(filters.search ? {
      OR: [
        { originalFilename: { contains: filters.search, mode: 'insensitive' } },
        { sanitizedFilename: { contains: filters.search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.resumeImportItem.findMany({
      where,
      orderBy: { [orderField]: direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.resumeImportItem.count({ where }),
  ]);

  return {
    items: items.map(serializeItem),
    meta: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
  };
}

export async function getResumeImportItem(actorUser, batchId, itemId, organisationId = null) {
  const { context } = await ensureReadableBatch(actorUser, batchId, organisationId);
  const item = await prisma.resumeImportItem.findFirst({
    where: { id: itemId, batchId, organisationId: context.organisationId },
  });
  if (!item) {
    throw buildError('Resume import item not found.', 404, 'ITEM_NOT_FOUND');
  }
  return serializeItem(item);
}

export async function updateResumeImportItem(actorUser, batchId, itemId, payload, organisationId = null, requestMeta = {}) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  const nextParsedData = buildParsedDataPatch(item.parsedData, payload);
  const updated = await prisma.resumeImportItem.update({
    where: { id: item.id },
    data: {
      parsedData: payload.parsedData || nextParsedData,
      requiresManualReview: payload.requiresManualReview ?? item.requiresManualReview,
      reviewNotes: payload.reviewNotes ?? item.reviewNotes,
      status: item.status === 'FAILED' ? 'REVIEW_REQUIRED' : item.status,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.item.updated',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId, fields: Object.keys(payload) },
    ...requestMeta,
  });

  await refreshBatchCounts(batchId);
  return serializeItem(updated);
}

export async function retryResumeImportItem(actorUser, batchId, itemId, { force = false } = {}, organisationId = null, requestMeta = {}) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  if (!force && !RETRYABLE_ITEM_STATUSES.has(item.status)) {
    throw buildError('Only failed, duplicate, or review-required items can be retried.', 409, 'RETRY_NOT_ALLOWED');
  }

  const updated = await prisma.resumeImportItem.update({
    where: { id: item.id },
    data: {
      status: 'QUEUED',
      errorCode: null,
      errorMessage: null,
      duplicateCandidateId: null,
      duplicateReason: null,
      duplicateMatchFields: Prisma.JsonNull,
      duplicateResolution: 'PENDING',
      processingStartedAt: null,
      processingCompletedAt: null,
      retryCount: { increment: 1 },
    },
  });
  await enqueueItemProcessing(updated, actorUser.id, force);
  await refreshBatchCounts(batchId);

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.item.retried',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId, force },
    ...requestMeta,
  });

  return serializeItem(updated);
}

export async function retryFailedResumeImportBatchItems(actorUser, batchId, { includeReviewRequired = false } = {}, organisationId = null, requestMeta = {}) {
  const { context } = await ensureReadableBatch(actorUser, batchId, organisationId);
  const statuses = includeReviewRequired ? ['FAILED', 'REVIEW_REQUIRED'] : ['FAILED'];
  const items = await prisma.resumeImportItem.findMany({
    where: {
      batchId,
      organisationId: context.organisationId,
      status: { in: statuses },
    },
  });

  for (const item of items) {
    const updated = await prisma.resumeImportItem.update({
      where: { id: item.id },
      data: {
        status: 'QUEUED',
        errorCode: null,
        errorMessage: null,
        processingStartedAt: null,
        processingCompletedAt: null,
        retryCount: { increment: 1 },
      },
    });
    await enqueueItemProcessing(updated, actorUser.id, true);
  }

  await refreshBatchCounts(batchId);
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.batch.retried',
    entityType: 'ResumeImportBatch',
    entityId: batchId,
    metadata: { count: items.length, includeReviewRequired },
    ...requestMeta,
  });

  return {
    batchId,
    retriedCount: items.length,
  };
}

export async function rejectResumeImportItem(actorUser, batchId, itemId, payload, organisationId = null, requestMeta = {}) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  const updated = await prisma.resumeImportItem.update({
    where: { id: item.id },
    data: {
      status: 'CANCELLED',
      duplicateResolution: item.status === 'DUPLICATE' ? 'REJECTED' : item.duplicateResolution,
      reviewNotes: payload.reviewNotes,
      resolvedByUserId: actorUser.id,
      resolvedAt: new Date(),
    },
  });
  await refreshBatchCounts(batchId);

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.item.rejected',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId },
    ...requestMeta,
  });

  return serializeItem(updated);
}

export async function confirmResumeImportItem(actorUser, batchId, itemId, payload, organisationId = null, requestMeta = {}) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  const result = await prisma.$transaction(async (tx) => {
    const freshItem = await tx.resumeImportItem.findUnique({ where: { id: item.id } });
    if (!freshItem) {
      throw buildError('Resume import item not found.', 404, 'ITEM_NOT_FOUND');
    }
    if (freshItem.candidateId && freshItem.status === 'IMPORTED') {
      return { item: freshItem, candidate: await tx.candidateProfile.findUnique({ where: { id: freshItem.candidateId } }) };
    }

    const parsedData = buildParsedDataPatch(freshItem.parsedData, payload);
    const duplicate = await detectDuplicateCandidate(freshItem.organisationId, parsedData, tx);
    if (duplicate && !duplicate.suggestedOnly) {
      const duplicateItem = await tx.resumeImportItem.update({
        where: { id: freshItem.id },
        data: {
          status: 'DUPLICATE',
          duplicateCandidateId: duplicate.candidate.id,
          duplicateReason: duplicate.reason,
          duplicateMatchFields: duplicate.matchFields,
          parsedData,
          requiresManualReview: true,
        },
      });
      await refreshBatchCounts(batchId, tx);
      return { item: duplicateItem, candidate: null, duplicate: true };
    }

    const created = await createImportedCandidate(tx, {
      ...freshItem,
      parsedData,
    }, actorUser.id, payload);
    const updatedItem = await tx.resumeImportItem.update({
      where: { id: freshItem.id },
      data: {
        status: 'IMPORTED',
        candidateId: created.candidate.id,
        parsedData,
        parserVersion: created.candidate.parserVersion,
        requiresManualReview: created.profileStatus === 'REVIEW_REQUIRED',
        resolvedByUserId: actorUser.id,
        resolvedAt: new Date(),
      },
    });
    await refreshBatchCounts(batchId, tx);
    return { item: updatedItem, candidate: created.candidate };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.item.confirmed',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId, candidateId: result.candidate?.id || null },
    ...requestMeta,
  });

  const confirmedCandidateId = result.candidate?.id || result.item.candidateId || null;
  if (confirmedCandidateId) {
    await Promise.allSettled([
      markCandidateIntelligenceStale(confirmedCandidateId, 'RESUME_IMPORT_CONFIRMED'),
      enqueueResumeSearchIndexUpsertBestEffort(confirmedCandidateId, {
        correlationId: item.id,
        createdByUserId: actorUser.id,
      }),
    ]);
  }

  return {
    item: serializeItem(result.item),
    candidateId: confirmedCandidateId,
    duplicate: Boolean(result.duplicate),
  };
}

export async function resolveResumeImportDuplicate(actorUser, batchId, itemId, payload, organisationId = null, requestMeta = {}) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  if (item.status !== 'DUPLICATE' && !item.duplicateCandidateId) {
    throw buildError('Item is not in duplicate review.', 409, 'NOT_DUPLICATE');
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshItem = await tx.resumeImportItem.findUnique({ where: { id: item.id } });
    if (!freshItem) {
      throw buildError('Resume import item not found.', 404, 'ITEM_NOT_FOUND');
    }

    if (payload.resolution === 'SKIPPED' || payload.resolution === 'REJECTED') {
      const updated = await tx.resumeImportItem.update({
        where: { id: freshItem.id },
        data: {
          status: 'CANCELLED',
          duplicateResolution: payload.resolution,
          reviewNotes: payload.reviewNotes ?? freshItem.reviewNotes,
          resolvedByUserId: actorUser.id,
          resolvedAt: new Date(),
        },
      });
      await refreshBatchCounts(batchId, tx);
      return { item: updated, candidateId: null };
    }

    const existingCandidateId = payload.existingCandidateId || freshItem.duplicateCandidateId;
    if (!existingCandidateId && payload.resolution !== 'CREATED_SEPARATE') {
      throw buildError('An existing candidate is required for this resolution.', 422, 'MISSING_EXISTING_CANDIDATE');
    }

    if (payload.resolution === 'ATTACHED_TO_EXISTING') {
      await attachResumeToExistingCandidate(tx, existingCandidateId, actorUser.id, freshItem);
      const updated = await tx.resumeImportItem.update({
        where: { id: freshItem.id },
        data: {
          status: 'IMPORTED',
          candidateId: existingCandidateId,
          duplicateResolution: 'ATTACHED_TO_EXISTING',
          reviewNotes: payload.reviewNotes ?? freshItem.reviewNotes,
          resolvedByUserId: actorUser.id,
          resolvedAt: new Date(),
        },
      });
      await refreshBatchCounts(batchId, tx);
      return { item: updated, candidateId: existingCandidateId };
    }

    if (payload.resolution === 'UPDATE_EMPTY_FIELDS' || payload.resolution === 'REPLACE_SELECTED_FIELDS') {
      const existing = await tx.candidateProfile.findUnique({ where: { id: existingCandidateId } });
      if (!existing || existing.organisationId !== freshItem.organisationId) {
        throw buildError('Existing candidate not found.', 404, 'EXISTING_CANDIDATE_NOT_FOUND');
      }
      const candidateData = buildCandidateDataFromParsed(freshItem);
      const replaceFields = new Set(payload.fieldsToReplace || []);
      const updates = {};
      const writable = [
        'fullName', 'email', 'phoneNumber', 'normalizedPhoneNumber', 'linkedInUrl', 'linkedInUrlNormalized',
        'currentTitle', 'currentEmployer', 'currentDesignation', 'location', 'summary', 'skills',
      ];
      for (const field of writable) {
        const nextValue = candidateData[field];
        if (nextValue == null || (Array.isArray(nextValue) && !nextValue.length)) continue;
        const currentValue = existing[field];
        const isEmpty = currentValue == null || currentValue === '' || (Array.isArray(currentValue) && !currentValue.length);
        if (payload.resolution === 'UPDATE_EMPTY_FIELDS' ? isEmpty : replaceFields.has(field)) {
          updates[field] = nextValue;
        }
      }
      await tx.candidateProfile.update({
        where: { id: existingCandidateId },
        data: updates,
      });
      await attachResumeToExistingCandidate(tx, existingCandidateId, actorUser.id, freshItem);
      const updated = await tx.resumeImportItem.update({
        where: { id: freshItem.id },
        data: {
          status: 'IMPORTED',
          candidateId: existingCandidateId,
          duplicateResolution: payload.resolution,
          reviewNotes: payload.reviewNotes ?? freshItem.reviewNotes,
          resolvedByUserId: actorUser.id,
          resolvedAt: new Date(),
        },
      });
      await refreshBatchCounts(batchId, tx);
      return { item: updated, candidateId: existingCandidateId };
    }

    if (payload.resolution === 'CREATED_SEPARATE') {
      const created = await createImportedCandidate(tx, freshItem, actorUser.id, {});
      const updated = await tx.resumeImportItem.update({
        where: { id: freshItem.id },
        data: {
          status: 'IMPORTED',
          candidateId: created.candidate.id,
          duplicateResolution: 'CREATED_SEPARATE',
          reviewNotes: payload.reviewNotes ?? freshItem.reviewNotes,
          resolvedByUserId: actorUser.id,
          resolvedAt: new Date(),
        },
      });
      await refreshBatchCounts(batchId, tx);
      return { item: updated, candidateId: created.candidate.id };
    }

    throw buildError('Unsupported duplicate resolution.', 422, 'INVALID_DUPLICATE_RESOLUTION');
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.duplicate.resolved',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId, resolution: payload.resolution, candidateId: result.candidateId },
    ...requestMeta,
  });

  if (result.candidateId) {
    await Promise.allSettled([
      markCandidateIntelligenceStale(result.candidateId, 'RESUME_IMPORT_DUPLICATE_RESOLVED'),
      enqueueResumeSearchIndexUpsertBestEffort(result.candidateId, {
        correlationId: item.id,
        createdByUserId: actorUser.id,
      }),
    ]);
  }

  return {
    item: serializeItem(result.item),
    candidateId: result.candidateId,
  };
}

export async function getResumeImportFailureReport(actorUser, batchId, organisationId = null) {
  const { context } = await ensureReadableBatch(actorUser, batchId, organisationId);
  const items = await prisma.resumeImportItem.findMany({
    where: {
      batchId,
      organisationId: context.organisationId,
      status: { in: ['FAILED', 'REVIEW_REQUIRED', 'DUPLICATE', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  const header = ['filename', 'status', 'errorCode', 'errorMessage', 'retryEligible'];
  const rows = items.map((item) => [
    item.originalFilename,
    item.status,
    item.errorCode || '',
    item.errorMessage || item.duplicateReason || '',
    RETRYABLE_ITEM_STATUSES.has(item.status) ? 'true' : 'false',
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');

  return {
    filename: `resume-import-${batchId}-failures.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: csv,
  };
}

export async function getResumeImportItemDownload(actorUser, batchId, itemId, organisationId = null) {
  const { context, item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  const presignedUrl = await createPrivateDownloadUrl(item.storageProvider, item.storedObjectKey, {
    expiresInSeconds: 300,
    downloadFilename: item.originalFilename,
    mimeType: item.mimeType,
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resumeImport.item.download',
    entityType: 'ResumeImportItem',
    entityId: item.id,
    metadata: { batchId, presigned: Boolean(presignedUrl) },
  });

  if (presignedUrl) {
    return {
      downloadUrl: presignedUrl,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      direct: false,
    };
  }

  return {
    downloadUrl: `/api/resume-imports/${batchId}/items/${itemId}/download`,
    expiresAt: null,
    direct: true,
  };
}

export async function streamResumeImportItemFile(actorUser, batchId, itemId, organisationId = null) {
  const { item } = await ensureWritableItem(actorUser, batchId, itemId, organisationId);
  const file = await readPrivateFileNodeStream(item.storageProvider, item.storedObjectKey);
  return {
    item,
    file,
  };
}

export async function processResumeImportItem(itemId, workerId = null, taskId = null) {
  const item = await prisma.resumeImportItem.findUnique({ where: { id: itemId } });
  if (!item) return 'cancelled';
  if (!['QUEUED', 'UPLOADED'].includes(item.status)) return 'cancelled';
  if (isResumeImportBatchBlocked(item.batchId)) {
    return 'cancelled';
  }

  // Atomic (not read-then-write) claim of the item itself: closes the gap
  // between the findUnique above and the write below, so two near-simultaneous
  // calls for the same item (e.g. from a lingering duplicate task) can't both
  // proceed past this point.
  const claim = await prisma.resumeImportItem.updateMany({
    where: { id: item.id, status: { in: ['QUEUED', 'UPLOADED'] } },
    data: {
      status: 'EXTRACTING',
      processingStartedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });
  if (claim.count !== 1) return 'cancelled';

  const renewLease = async () => {
    if (!taskId) return;
    await renewTaskLease(taskId, workerId).catch(() => {});
  };

  try {
    const stored = await readPrivateFileNodeStream(item.storageProvider, item.storedObjectKey);
    const fileBuffer = await streamToBuffer(stored.stream);
    const extracted = sanitizeResumeData(await extractResumeText({ extension: item.fileExtension, fileBuffer }));
    const trimmedText = sanitizeResumeString(extracted.text || '').slice(0, env.resumeImportMaxTextChars);

    let parsedData = null;
    let parserVersion = null;
    let errorCode = extracted.errorCode;
    let errorMessage = null;
    let processingMetadata = sanitizeResumeData({
      workerId,
      aiEnabled: env.aiResumeParsingEnabled,
      aiProvider: env.aiProvider,
      extraction: {
        totalPages: extracted.totalPages || null,
        strategy: extracted.strategy || null,
      },
      documentProcessor: {
        enabled: env.documentProcessorEnabled,
        integrationEnabled: env.documentProcessorIntegrationEnabled,
        rolloutMatched: false,
        attempted: false,
        used: false,
      },
    });

    await renewLease();

    const canUseDocumentProcessor = isResumeImportDocumentProcessorAllowed(item);
    let documentProcessorOutcome = null;

    if (canUseDocumentProcessor) {
      documentProcessorOutcome = await buildResumeImportDocumentProcessorResult({
        item,
        fileBuffer,
        legacyExtractedText: trimmedText,
      });

      processingMetadata.documentProcessor = sanitizeResumeData({
        enabled: env.documentProcessorEnabled,
        integrationEnabled: env.documentProcessorIntegrationEnabled,
        ...documentProcessorOutcome.metadata,
      });
    }

    const activeText = sanitizeResumeString(documentProcessorOutcome?.used
      ? documentProcessorOutcome.extractedText
      : trimmedText || '').slice(0, env.resumeImportMaxTextChars);

    if (activeText) {
      await prisma.resumeImportItem.update({
        where: { id: item.id },
        data: {
          status: 'PARSING',
        },
      });

      if (documentProcessorOutcome?.used && documentProcessorOutcome?.parsedData) {
        parsedData = sanitizeResumeData(documentProcessorOutcome.parsedData);
        parserVersion = documentProcessorOutcome.parserVersion || parsedData?.metadata?.parser || null;
      } else {
        try {
          parsedData = sanitizeResumeData(await parseResumeText(activeText, { originalFilename: item.originalFilename }));
          parserVersion = parsedData?.metadata?.parser || parsedData?.metadata?.provider || null;
        } catch (error) {
          errorCode = error.code || 'AI_PARSING_FAILED';
          errorMessage = String(error.message || 'AI parsing failed.').slice(0, 1000);
        }
      }

      if (!documentProcessorOutcome?.used && documentProcessorOutcome?.attempted) {
        processingMetadata.documentProcessor = sanitizeResumeData({
          ...processingMetadata.documentProcessor,
          fallbackReason: documentProcessorOutcome.fallbackReason || null,
          fallbackMessage: documentProcessorOutcome.fallbackMessage || null,
          retryable: Boolean(documentProcessorOutcome.retryable),
        });
      }
    }

    await renewLease();

    const duplicate = parsedData ? await detectDuplicateCandidate(item.organisationId, parsedData) : null;
    let status = 'READY';
    let duplicateCandidateId = null;
    let duplicateReason = null;
    let duplicateMatchFields = null;
    let requiresManualReview = extracted.requiresManualReview
      || documentProcessorOutcome?.requiresManualReview
      || !parsedData
      || !hasMinimumIdentity(parsedData);

    if (duplicate && !duplicate.suggestedOnly) {
      status = 'DUPLICATE';
      duplicateCandidateId = duplicate.candidate.id;
      duplicateReason = duplicate.reason;
      duplicateMatchFields = duplicate.matchFields;
      requiresManualReview = true;
    } else if (duplicate?.suggestedOnly) {
      requiresManualReview = true;
      status = 'REVIEW_REQUIRED';
      duplicateCandidateId = duplicate.candidate.id;
      duplicateReason = duplicate.reason;
      duplicateMatchFields = duplicate.matchFields;
    } else if (requiresManualReview) {
      status = 'REVIEW_REQUIRED';
    }

    const updated = await prisma.resumeImportItem.update({
      where: { id: item.id },
      data: {
        status,
        extractedText: sanitizeResumeString(activeText || null),
        parsedData: sanitizeResumeData(parsedData || null),
        parserVersion,
        parsingConfidence: sanitizeResumeData(parsedData?.candidate || Prisma.JsonNull),
        duplicateCandidateId,
        duplicateReason,
        duplicateMatchFields: duplicateMatchFields || Prisma.JsonNull,
        requiresManualReview,
        errorCode,
        errorMessage,
        processingCompletedAt: new Date(),
        metadata: processingMetadata,
      },
    });
    await refreshBatchCounts(item.batchId);
    return updated.status === 'FAILED' ? 'cancelled' : 'success';
  } catch (error) {
    await prisma.resumeImportItem.update({
      where: { id: item.id },
      data: {
        status: 'FAILED',
        errorCode: error.code || 'RESUME_IMPORT_PROCESSING_FAILED',
        errorMessage: String(error.message || 'Resume import item processing failed.').slice(0, 1000),
        retryCount: { increment: 1 },
        processingCompletedAt: new Date(),
      },
    });
    await refreshBatchCounts(item.batchId);
    throw error;
  }
}
