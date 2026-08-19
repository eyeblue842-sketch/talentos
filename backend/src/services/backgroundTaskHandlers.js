import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { sendOfferStatusEmail, sendQueuedEmailPayload, sendSubscriptionRenewalReminderEmail, sendJobAutoClosedEmail } from './emailService.js';
import { calculateProfileCompletion, requestCandidateDataExport } from './candidateService.js';
import { getResumeIntelligence } from '../intelligence/services/resumeIntelligenceService.js';
import { markCandidateIntelligenceStale, runCandidateIntelligenceGenerationTask } from '../intelligence/services/candidateIntelligenceService.js';
import { runCandidateJobMatchGenerationTask } from '../intelligence/services/candidateMatchEngineService.js';
import { getCandidateMatchIntelligence, getBatchCandidateMatchIntelligence } from '../intelligence/services/candidateMatchService.js';
import { runCandidateMatchBulkGenerationTask, runJobCandidateRankingGenerationTask } from '../intelligence/services/candidateRankingService.js';
import { runJobDescriptionGenerationTask } from '../intelligence/services/jobDescriptionGenerationService.js';
import { getJobIntelligence } from '../intelligence/services/jobIntelligenceService.js';
import { getInterviewIntelligence } from '../intelligence/services/interviewIntelligenceService.js';
import { getAnalyticsInsight } from '../intelligence/services/analyticsInsightService.js';
import { parseTalentSearchQuery } from '../intelligence/services/talentSearchService.js';
import { markBackgroundTaskCancelled } from './backgroundTaskService.js';
import {
  buildBlockedResumeImportBatchReason,
  isResumeImportBatchBlocked,
  processResumeImportItem,
} from './resumeImportService.js';
import { readPrivateFileNodeStream } from '../config/storage.js';
import {
  assessResumeTextQuality,
  extractResumeText,
  getExtension,
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizePhone,
  sanitizeParsedCandidateField,
  sanitizeResumeData,
  sanitizeResumeString,
} from './resumeImportUtils.js';
import { getResumeAiProviderSelection } from './ai/ai-provider.js';
import { parseResumeText, RESUME_PARSER_VERSION } from './ai/resume-parser.js';
import { indexCandidateResume } from './searchService.js';
import { enqueueResumeSearchIndexUpsert, processResumeSearchIndexTask } from './resumeSearchV2/indexingService.js';
import {
  normalizeCandidateProfileForPresentation,
  sanitizeStructuredCandidateField,
} from './candidateProfileSanitizer.js';

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

function comparableScalarValue(field, value) {
  if (value == null) return null;
  if (field === 'phoneNumber') {
    return normalizePhone(value);
  }
  return String(value).trim().toLowerCase();
}

function hasConflictingScalarValue(field, currentValue, parsedValue) {
  const currentComparable = comparableScalarValue(field, currentValue);
  const parsedComparable = comparableScalarValue(field, parsedValue);
  return Boolean(currentComparable && parsedComparable && currentComparable !== parsedComparable);
}

function uniqueStrings(values = []) {
  return [...new Set(values
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function mergeStringArrays(currentValue = [], parsedValue = []) {
  return uniqueStrings([...(Array.isArray(currentValue) ? currentValue : []), ...(Array.isArray(parsedValue) ? parsedValue : [])]);
}

function mergeStructuredArrays(field, currentValue = [], parsedValue = []) {
  return sanitizeStructuredCandidateField(field, [
    ...(Array.isArray(currentValue) ? currentValue : []),
    ...(Array.isArray(parsedValue) ? parsedValue : []),
  ]);
}

function isEmptyStructuredValue(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function fieldValue(parsedData, field) {
  return parsedData?.candidate?.[field]?.value ?? null;
}

function fieldConfidence(parsedData, field) {
  return Number(parsedData?.candidate?.[field]?.confidence || 0);
}

function buildResumeFailurePayload(asset, errorCode, errorMessage, extra = {}) {
  return sanitizeResumeData({
    parser: 'careeriz-resume-worker-v1',
    status: 'FAILED',
    assetId: asset.id,
    extractedTextAvailable: false,
    errorCode,
    errorMessage: String(errorMessage || 'Resume parsing failed.').slice(0, 1000),
    processedAt: new Date().toISOString(),
    ...extra,
  });
}

function buildCandidateProfilePatch(profile, parsedData, rawResumeText) {
  const safeParsedData = sanitizeResumeData(parsedData);
  const safeRawResumeText = sanitizeResumeString(rawResumeText);
  const normalizedExistingProfile = normalizeCandidateProfileForPresentation(profile);
  const updateData = {};
  const appliedFields = [];
  const preservedFields = [];
  const suggestedUpdates = {};

  const scalarFields = [
    ['fullName', fieldValue(safeParsedData, 'fullName')],
    ['email', normalizeEmail(fieldValue(safeParsedData, 'email'))],
    ['phoneNumber', fieldValue(safeParsedData, 'phoneNumber')],
    ['headline', fieldValue(safeParsedData, 'headline')],
    ['currentTitle', fieldValue(safeParsedData, 'currentTitle')],
    ['currentEmployer', fieldValue(safeParsedData, 'currentEmployer')],
    ['currentDesignation', fieldValue(safeParsedData, 'currentDesignation')],
    ['location', fieldValue(safeParsedData, 'location')],
    ['currentCity', fieldValue(safeParsedData, 'currentCity')],
    ['currentState', fieldValue(safeParsedData, 'currentState')],
    ['currentCountry', fieldValue(safeParsedData, 'currentCountry')],
    ['summary', fieldValue(safeParsedData, 'summary')],
    ['portfolioUrl', fieldValue(safeParsedData, 'portfolioUrl')],
    ['linkedInUrl', fieldValue(safeParsedData, 'linkedInUrl')],
    ['githubUrl', fieldValue(safeParsedData, 'githubUrl')],
  ];

  for (const [field, parsedValue] of scalarFields) {
    const safeValue = typeof parsedValue === 'string'
      ? sanitizeParsedCandidateField(field, parsedValue)
      : parsedValue;
    const confidence = fieldConfidence(safeParsedData, field);
    if (!hasMeaningfulValue(safeValue)) continue;
    if (typeof safeValue === 'string' && confidence < 0.5 && ['headline', 'currentTitle', 'currentEmployer', 'currentDesignation', 'location'].includes(field)) {
      continue;
    }
    const existingValue = normalizedExistingProfile?.[field] ?? null;
    if (hasMeaningfulValue(existingValue)) {
      if (hasConflictingScalarValue(field, existingValue, parsedValue) && [
        'currentTitle',
        'currentEmployer',
        'currentDesignation',
        'location',
        'headline',
        'summary',
        'phoneNumber',
      ].includes(field)) {
        suggestedUpdates[field] = sanitizeResumeData({
          field,
          currentValue: existingValue,
          resumeValue: safeValue,
          confidence,
          source: 'SELF_UPLOAD_RESUME',
        });
      }
      preservedFields.push(field);
      continue;
    }
    updateData[field] = safeValue;
    appliedFields.push(field);
  }

  if (updateData.linkedInUrl && !hasMeaningfulValue(profile.linkedInUrlNormalized)) {
    updateData.linkedInUrlNormalized = normalizeLinkedInUrl(updateData.linkedInUrl);
    appliedFields.push('linkedInUrlNormalized');
  }

  if (updateData.phoneNumber && !hasMeaningfulValue(profile.normalizedPhoneNumber)) {
    updateData.normalizedPhoneNumber = normalizePhone(updateData.phoneNumber);
    appliedFields.push('normalizedPhoneNumber');
  }

  const parsedTotalExperience = fieldValue(safeParsedData, 'totalExperience');
  if (Number.isFinite(parsedTotalExperience) && parsedTotalExperience > 0) {
    if (!Number.isFinite(profile.totalExperience) || profile.totalExperience <= 0) {
      updateData.totalExperience = parsedTotalExperience;
      appliedFields.push('totalExperience');
    } else {
      preservedFields.push('totalExperience');
    }
  }

  const mergeArrayFields = ['skills', 'functionalSkills', 'tools', 'frameworks', 'cloudPlatforms', 'databases', 'softSkills'];
  for (const field of mergeArrayFields) {
    const currentValue = Array.isArray(normalizedExistingProfile?.[field]) ? normalizedExistingProfile[field] : [];
    const rawCurrentValue = Array.isArray(profile?.[field]) ? profile[field] : [];
    const parsedValue = fieldValue(safeParsedData, field);
    if (!Array.isArray(parsedValue) || !parsedValue.length) continue;
    const merged = mergeStringArrays(currentValue, parsedValue);
    if (JSON.stringify(merged) !== JSON.stringify(currentValue) || JSON.stringify(currentValue) !== JSON.stringify(rawCurrentValue)) {
      updateData[field] = merged;
      appliedFields.push(field);
      continue;
    }
    preservedFields.push(field);
  }

  const structuredFields = ['experienceEntries', 'educationEntries', 'certificationEntries', 'projectEntries', 'languageEntries', 'portfolioLinks'];
  for (const field of structuredFields) {
    const rawParsedValue = fieldValue(safeParsedData, field);
    const parsedValue = sanitizeStructuredCandidateField(field, rawParsedValue);
    const existingValue = sanitizeStructuredCandidateField(field, profile?.[field]);
    const rawExistingValue = Array.isArray(profile?.[field]) ? profile[field] : [];
    const mergedValue = mergeStructuredArrays(field, existingValue, parsedValue);

    if (isEmptyStructuredValue(existingValue) && isEmptyStructuredValue(parsedValue)) continue;

    if (!isEmptyStructuredValue(mergedValue)) {
      if (JSON.stringify(mergedValue) !== JSON.stringify(existingValue) || JSON.stringify(existingValue) !== JSON.stringify(rawExistingValue)) {
        updateData[field] = mergedValue;
        appliedFields.push(field);
        continue;
      }
      preservedFields.push(field);
      continue;
    }

    if (!isEmptyStructuredValue(existingValue)) {
      updateData[field] = mergedValue;
      appliedFields.push(field);
    }
  }

  updateData.rawResumeText = safeRawResumeText;
  updateData.parserVersion = safeParsedData?.metadata?.parserVersion || RESUME_PARSER_VERSION;
  updateData.parserMetadata = sanitizeResumeData({
    parser: safeParsedData?.metadata?.parser || 'careeriz-resume-parser-v3',
    parserVersion: safeParsedData?.metadata?.parserVersion || RESUME_PARSER_VERSION,
    provider: safeParsedData?.metadata?.provider || null,
    model: safeParsedData?.metadata?.model || null,
    stages: safeParsedData?.metadata?.stages || null,
    generatedAt: safeParsedData?.metadata?.generatedAt || new Date().toISOString(),
    aiProvider: Boolean(safeParsedData?.metadata?.aiProvider),
  });
  updateData.provenanceMetadata = sanitizeResumeData({
    ...(profile.provenanceMetadata || {}),
    resumeParsing: {
      source: 'SELF_UPLOAD',
      lastParsedAt: new Date().toISOString(),
      appliedFields,
      preservedFields,
    },
  });

  const mergedProfile = { ...profile, ...updateData };
  updateData.profileCompletenessScore = calculateProfileCompletion(mergedProfile).percentage;

  return {
    updateData: sanitizeResumeData(updateData),
    appliedFields: sanitizeResumeData(appliedFields),
    preservedFields: sanitizeResumeData(preservedFields),
    suggestedUpdates: sanitizeResumeData(suggestedUpdates),
  };
}

async function markResumeAssetFailed(asset, errorCode, errorMessage, extra = {}) {
  await prisma.resumeAsset.update({
    where: { id: asset.id },
    data: {
      parsingStatus: 'FAILED',
      parsedData: buildResumeFailurePayload(asset, errorCode, errorMessage, extra),
    },
  });
}

async function handleResumeParsingTask(task) {
  const asset = await prisma.resumeAsset.findUnique({
    where: { id: task.payload?.assetId || task.entityId || '' },
    include: { candidate: true },
  });
  if (!asset || asset.status === 'DELETED') return 'cancelled';

  console.log(JSON.stringify({
    level: 'info',
    event: 'resume.parse.task.started',
    taskId: task.id,
    assetId: asset.id,
    candidateId: asset.candidateId,
  }));

  await prisma.resumeAsset.update({
    where: { id: asset.id },
    data: { parsingStatus: 'PROCESSING' },
  });

  try {
    const stored = await readPrivateFileNodeStream(asset.storageProvider, asset.storageKey);
    const fileBuffer = await streamToBuffer(stored.stream);
    const extension = getExtension(asset.originalFilename);
    const extracted = sanitizeResumeData(await extractResumeText({ extension, fileBuffer }));
    const trimmedText = sanitizeResumeString(extracted.text || '').trim();
    const extractionQuality = assessResumeTextQuality(trimmedText);

    console.log(JSON.stringify({
      level: 'info',
      event: 'resume.parse.extraction.completed',
      taskId: task.id,
      assetId: asset.id,
      candidateId: asset.candidateId,
      strategy: extracted.strategy || null,
      textLength: trimmedText.length,
      qualityScore: extractionQuality.score,
      usable: extractionQuality.usable,
      reasonCount: extractionQuality.reasons.length,
      errorCode: extracted.errorCode || null,
    }));

    if (!trimmedText || !extractionQuality.usable) {
      await markResumeAssetFailed(
        asset,
        extracted.errorCode || 'RESUME_TEXT_EXTRACTION_FAILED',
        extracted.errorCode === 'PDF_TEXT_LOW_QUALITY' || extracted.errorCode === 'DOCX_TEXT_LOW_QUALITY' || extracted.errorCode === 'DOC_TEXT_LOW_QUALITY'
          ? 'Careeriz detected low-quality resume text extraction and skipped profile updates.'
          : 'Careeriz could not extract meaningful text from this resume.',
        {
          requiresManualReview: Boolean(extracted.requiresManualReview),
          strategy: extracted.strategy || null,
          quality: extracted.quality || {
            score: extractionQuality.score,
            reasons: extractionQuality.reasons,
          },
        },
      );
      return 'success';
    }

    const aiSelection = getResumeAiProviderSelection();
    console.log(JSON.stringify({
      level: 'info',
      event: 'resume.parse.provider.selected',
      taskId: task.id,
      assetId: asset.id,
      candidateId: asset.candidateId,
      provider: aiSelection.provider,
      mode: aiSelection.mode,
      model: aiSelection.model,
      enabled: aiSelection.enabled,
      parserVersion: RESUME_PARSER_VERSION,
    }));

    const parsedData = sanitizeResumeData(await parseResumeText(trimmedText, { originalFilename: asset.originalFilename }));
    console.log(JSON.stringify({
      level: 'info',
      event: parsedData?.metadata?.aiProvider ? 'resume.parse.ai.completed' : 'resume.parse.ai.skipped',
      taskId: task.id,
      assetId: asset.id,
      candidateId: asset.candidateId,
      provider: parsedData?.metadata?.provider || aiSelection.provider,
      model: parsedData?.metadata?.model || aiSelection.model || null,
      parserVersion: parsedData?.metadata?.parserVersion || RESUME_PARSER_VERSION,
      aiRequested: Boolean(parsedData?.metadata?.aiRequested),
      aiProvider: Boolean(parsedData?.metadata?.aiProvider),
      aiFallbackReason: parsedData?.metadata?.aiFallbackReason || null,
    }));

    const candidatePatch = buildCandidateProfilePatch(asset.candidate, parsedData, trimmedText);
    const updatedCandidate = await prisma.candidateProfile.update({
      where: { id: asset.candidateId },
      data: sanitizeResumeData(candidatePatch.updateData),
    });
    const availableFields = Object.keys(parsedData?.candidate || {}).filter((field) => hasMeaningfulValue(fieldValue(parsedData, field)));

    const parsingStatus = extracted.requiresManualReview
      || Boolean(parsedData?.metadata?.aiFallbackReason)
      ? 'PARTIAL'
      : 'COMPLETED';

    await prisma.resumeAsset.update({
      where: { id: asset.id },
      data: {
        parsingStatus,
        parsedText: sanitizeResumeString(trimmedText),
        parsedData: sanitizeResumeData({
          parser: parsedData?.metadata?.parser || 'careeriz-resume-parser-v3',
          parserVersion: parsedData?.metadata?.parserVersion || RESUME_PARSER_VERSION,
          provider: parsedData?.metadata?.provider || null,
          model: parsedData?.metadata?.model || null,
          aiProvider: Boolean(parsedData?.metadata?.aiProvider),
          aiRequested: Boolean(parsedData?.metadata?.aiRequested),
          aiFallbackReason: parsedData?.metadata?.aiFallbackReason || null,
          stages: parsedData?.metadata?.stages || null,
          extractedTextAvailable: true,
          requiresManualReview: Boolean(extracted.requiresManualReview || parsedData?.metadata?.aiFallbackReason),
          errorCode: extracted.errorCode || null,
          extractionMethod: extracted.strategy || null,
          extractionQuality: extracted.quality || {
            score: extractionQuality.score,
            reasons: extractionQuality.reasons,
          },
          ocrUsed: false,
          quality: extracted.quality || {
            score: extractionQuality.score,
            reasons: extractionQuality.reasons,
          },
          availableFields,
          appliedFields: candidatePatch.appliedFields,
          preservedFields: candidatePatch.preservedFields,
          suggestedUpdates: candidatePatch.suggestedUpdates,
          candidate: parsedData?.candidate || {},
          summary: parsedData?.metadata?.aiFallbackReason
            ? 'Careeriz parsed this resume with limited AI enrichment. Review the extracted details before relying on them.'
            : candidatePatch.appliedFields.length
              ? 'Careeriz extracted resume data and applied non-destructive profile updates.'
              : 'Careeriz extracted resume data but preserved the existing candidate profile values.',
          processedAt: new Date().toISOString(),
        }),
      },
    });

    await Promise.allSettled([
      indexCandidateResume(updatedCandidate),
      enqueueResumeSearchIndexUpsert(updatedCandidate.id, {
        correlationId: task.id,
      }),
      markCandidateIntelligenceStale(asset.candidateId, 'RESUME_PARSED'),
    ]);

    console.log(JSON.stringify({
      level: 'info',
      event: 'resume.parse.profile.updated',
      taskId: task.id,
      assetId: asset.id,
      candidateId: asset.candidateId,
      appliedFields: candidatePatch.appliedFields.length,
      preservedFields: candidatePatch.preservedFields.length,
      parsingStatus,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'resume.parse.failed',
      taskId: task.id,
      assetId: asset.id,
      candidateId: asset.candidateId,
      provider: task.payload?.provider || null,
      errorCode: error?.code || 'RESUME_PARSING_FAILED',
      message: error?.message || 'Resume parsing failed',
    }));
    await markResumeAssetFailed(asset, error?.code || 'RESUME_PARSING_FAILED', error?.message || 'Resume parsing failed.');
  }

  console.log(JSON.stringify({
    level: 'info',
    event: 'resume.parse.completed',
    taskId: task.id,
    assetId: asset.id,
    candidateId: asset.candidateId,
  }));

  return 'success';
}

async function handleResumeImportProcessingTask(task) {
  const itemId = task.payload?.itemId || task.entityId || '';
  if (!itemId) return 'cancelled';
  const item = await prisma.resumeImportItem.findUnique({
    where: { id: itemId },
    select: { id: true, batchId: true, status: true },
  });
  if (!item) {
    if (task.id) {
      await markBackgroundTaskCancelled(task.id, task.leaseOwnerId || null, 'Resume import item not found.');
    }
    return 'cancelled';
  }
  if (isResumeImportBatchBlocked(item.batchId)) {
    if (task.id) {
      await markBackgroundTaskCancelled(
        task.id,
        task.leaseOwnerId || null,
        buildBlockedResumeImportBatchReason(item.batchId),
      );
    }
    return 'cancelled';
  }
  // leaseOwnerId (not updatedByUserId, which is only populated for
  // human-triggered updates) holds the actual worker instance ID that
  // claimed this task — used both for observability (recorded on the item's
  // processing metadata) and to renew this task's lease mid-processing.
  await processResumeImportItem(itemId, task.leaseOwnerId || null, task.id);
  return 'success';
}

async function handleInterviewReminderTask(task) {
  const reminder = await prisma.meetingReminder.findUnique({
    where: { id: task.payload?.reminderId || task.entityId || '' },
    include: {
      participant: true,
      meeting: {
        include: {
          participants: true,
          interviewRound: {
            include: {
              interviewProcess: {
                include: {
                  application: {
                    include: {
                      candidate: { include: { user: true } },
                      submittedApplication: true,
                      job: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reminder || reminder.status !== 'SCHEDULED' || !reminder.meeting || reminder.meeting.status !== 'SCHEDULED') return 'cancelled';

  const round = reminder.meeting.interviewRound;
  const application = round.interviewProcess.application;
  const participant = reminder.participant;

  if (participant.userId) {
    await createNotification({
      organisationId: reminder.organisationId,
      recipientUserId: participant.userId,
      type: 'INTERVIEW',
      title: 'Interview reminder',
      message: `${round.roundName} for ${application.job?.title || 'this role'} starts soon.`,
      entityType: 'InterviewRound',
      entityId: round.id,
      metadata: {
        roundId: round.id,
        meetingId: reminder.meeting.id,
        reminderType: reminder.reminderType,
      },
    });
  }

  await prisma.meetingReminder.update({
    where: { id: reminder.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  return 'success';
}

async function handleOfferReminderTask(task) {
  const offer = await prisma.offer.findUnique({
    where: { id: task.payload?.offerId || task.entityId || '' },
    include: {
      candidate: { include: { user: true } },
      job: true,
    },
  });
  if (!offer || !['RELEASED', 'VIEWED'].includes(offer.status)) return 'cancelled';

  if (offer.candidate?.userId) {
    await createNotification({
      organisationId: offer.organisationId,
      recipientUserId: offer.candidate.userId,
      type: 'OFFER',
      title: 'Offer reminder',
      message: `Your offer for ${offer.job?.title || 'this role'} is expiring soon.`,
      entityType: 'Offer',
      entityId: offer.id,
      metadata: {
        reminderWindow: task.payload?.reminderWindow || 'scheduled',
      },
    });
  }
  if (offer.candidate?.user?.email) {
    await sendOfferStatusEmail(
      offer.candidate.user.email,
      'Your Careeriz offer is expiring soon',
      `Your offer for ${offer.job?.title || 'this role'} is expiring soon. Please review it before the expiry time.`,
      { queueOnFailure: false },
    );
  }
  return 'success';
}

async function handleOfferExpiryTask(task) {
  const offer = await prisma.offer.findUnique({
    where: { id: task.payload?.offerId || task.entityId || '' },
    include: {
      candidate: { include: { user: true } },
      job: true,
    },
  });
  if (!offer || !['RELEASED', 'VIEWED'].includes(offer.status)) return 'cancelled';
  if (!offer.expiryAt || new Date(offer.expiryAt) > new Date()) return 'cancelled';

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offer.id },
      data: {
        status: 'EXPIRED',
        updatedAt: new Date(),
      },
    });
    await tx.offerAccessToken.updateMany({
      where: {
        offerId: offer.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    await tx.application.updateMany({
      where: { id: offer.applicationId },
      data: {
        currentStage: 'REJECTED',
        statusLabel: 'Offer Expired',
      },
    });
  });

  if (offer.candidate?.userId) {
    await createNotification({
      organisationId: offer.organisationId,
      recipientUserId: offer.candidate.userId,
      type: 'OFFER',
      title: 'Offer expired',
      message: `Your offer for ${offer.job?.title || 'this role'} has expired.`,
      entityType: 'Offer',
      entityId: offer.id,
    });
  }

  await recordAuditLog({
    organisationId: offer.organisationId,
    actorUserId: null,
    action: 'worker.offer.expire',
    entityType: 'Offer',
    entityId: offer.id,
    metadata: { taskId: task.id },
  });

  return 'success';
}

// Section 8: T-15 renewal reminder. Re-validates the subscription is still
// due (not already reminded, not cancelled, still expiring within the
// window) before sending, so a task claimed twice after a crashed worker's
// lease expired can never double-notify. Records success/failure timestamps
// on the subscription itself (renewalReminderSentAt / renewalReminderFailedAt)
// independent of the underlying BackgroundTask row's own retry bookkeeping.
async function handleSubscriptionRenewalReminderTask(task) {
  const subscription = await prisma.companySubscription.findUnique({
    where: { id: task.payload?.subscriptionId || task.entityId || '' },
    include: { organisation: true },
  });
  if (!subscription || subscription.renewalReminderSentAt) return 'cancelled';
  if (!['ACTIVE', 'EXPIRING_SOON'].includes(subscription.status)) return 'cancelled';
  if (new Date(subscription.expiresAt) <= new Date()) return 'cancelled';

  const owners = await prisma.organisationMembership.findMany({
    where: { organisationId: subscription.organisationId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
    include: { user: true },
  });
  const daysRemaining = Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  try {
    await Promise.all(owners.map((membership) => createNotification({
      organisationId: subscription.organisationId,
      recipientUserId: membership.userId,
      type: 'BILLING',
      title: 'Your Careeriz plan is expiring soon',
      message: `${subscription.productCode} expires in ${daysRemaining} days. Renew to keep ATS and resume-database access.`,
      entityType: 'CompanySubscription',
      entityId: subscription.id,
      metadata: { daysRemaining },
    })));

    await Promise.all(owners
      .filter((membership) => membership.user?.email)
      .map((membership) => sendSubscriptionRenewalReminderEmail({
        to: membership.user.email,
        organisationName: subscription.organisation?.name || 'your company',
        productName: subscription.productCode,
        expiresAt: subscription.expiresAt,
        daysRemaining,
      }, { queueOnFailure: false })));

    await prisma.companySubscription.update({
      where: { id: subscription.id },
      data: { renewalReminderSentAt: new Date() },
    });
  } catch (error) {
    await prisma.companySubscription.update({
      where: { id: subscription.id },
      data: { renewalReminderFailedAt: new Date() },
    });
    throw error;
  }

  return 'success';
}

// Section 11: flips an expired job to CLOSED. Guarded on autoClosedAt IS
// NULL so it is safe to run twice for the same job (idempotent), and the
// state transition + audit log happen in one transaction so a partial
// failure never leaves the job CLOSED without an audit trail or vice versa.
async function handleJobAutoCloseTask(task) {
  const job = await prisma.job.findUnique({
    where: { id: task.payload?.jobId || task.entityId || '' },
    include: { recruiter: true },
  });
  if (!job || job.status !== 'OPEN' || job.autoClosedAt) return 'cancelled';
  if (!job.activeUntil || new Date(job.activeUntil) > new Date()) return 'cancelled';

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: { status: 'CLOSED', autoClosedAt: now },
    });
    await tx.auditLog.create({
      data: {
        organisationId: job.organisationId,
        actorUserId: null,
        action: 'worker.job.autoClose',
        entityType: 'Job',
        entityId: job.id,
        metadata: { activeUntil: job.activeUntil, taskId: task.id },
      },
    });
  });

  if (job.recruiterId) {
    await createNotification({
      organisationId: job.organisationId,
      recipientUserId: job.recruiterId,
      type: 'BILLING',
      title: 'Job posting closed',
      message: `${job.title} has closed after its 45-day active window ended.`,
      entityType: 'Job',
      entityId: job.id,
    });
  }
  if (job.recruiter?.email) {
    await sendJobAutoClosedEmail({ to: job.recruiter.email, jobTitle: job.title, activeUntil: job.activeUntil }, { queueOnFailure: false }).catch(() => {});
  }

  return 'success';
}

async function handleEmailRetryTask(task) {
  if (!task.payload?.message) return 'cancelled';
  await sendQueuedEmailPayload(task.payload.message);
  return 'success';
}

async function handleNotificationRetryTask(task) {
  if (!task.payload?.notification) return 'cancelled';
  await createNotification(task.payload.notification);
  return 'success';
}

async function handleIntelligenceExecutionTask(task) {
  const requestedByUserId = task.payload?.requestedByUserId;
  const operation = task.payload?.operation;
  const request = task.payload?.request;
  if (!requestedByUserId || !operation || !request) return 'cancelled';

  const actorUser = await prisma.user.findUnique({
    where: { id: requestedByUserId },
    include: {
      recruiterProfile: true,
      candidateProfile: true,
    },
  });
  if (!actorUser) return 'cancelled';

  switch (operation) {
    case 'resume':
      await getResumeIntelligence(actorUser, request);
      break;
    case 'match':
      await getCandidateMatchIntelligence(actorUser, request);
      break;
    case 'match-batch':
      await getBatchCandidateMatchIntelligence(actorUser, request);
      break;
    case 'job':
      await getJobIntelligence(actorUser, request);
      break;
    case 'interview':
      await getInterviewIntelligence(actorUser, request);
      break;
    case 'analytics':
      await getAnalyticsInsight(actorUser, request);
      break;
    case 'search-parse':
      await parseTalentSearchQuery(actorUser, request);
      break;
    default:
      return 'cancelled';
  }
  return 'success';
}

async function handleCandidateIntelligenceGenerationTask(task) {
  return runCandidateIntelligenceGenerationTask(task);
}

async function handleCandidateMatchGenerationTask(task) {
  return runCandidateJobMatchGenerationTask(task);
}

async function handleCandidateMatchBulkGenerationTask(task) {
  return runCandidateMatchBulkGenerationTask(task);
}

async function handleJobCandidateRankingGenerationTask(task) {
  return runJobCandidateRankingGenerationTask(task);
}

async function handleJobDescriptionGenerationTask(task) {
  return runJobDescriptionGenerationTask(task);
}

async function handleDataExportTask(task) {
  const candidateId = task.payload?.candidateId;
  const userId = task.payload?.userId;
  if (!candidateId || !userId) return 'cancelled';
  await requestCandidateDataExport(candidateId, userId);
  return 'success';
}

async function handleCleanupTask() {
  const expiryCutoff = new Date();
  await prisma.intelligenceResult.updateMany({
    where: {
      expiresAt: { lte: expiryCutoff },
      supersededAt: null,
    },
    data: {
      supersededAt: expiryCutoff,
    },
  });
  return 'success';
}

export async function processBackgroundTask(task) {
  switch (task.type) {
    case 'RESUME_PARSING':
      return handleResumeParsingTask(task);
    case 'RESUME_IMPORT_PROCESSING':
      return handleResumeImportProcessingTask(task);
    case 'RESUME_SEARCH_INDEX_SYNC':
      return processResumeSearchIndexTask(task);
    case 'INTERVIEW_REMINDER':
      return handleInterviewReminderTask(task);
    case 'OFFER_REMINDER':
      return handleOfferReminderTask(task);
    case 'OFFER_EXPIRY':
      return handleOfferExpiryTask(task);
    case 'SUBSCRIPTION_RENEWAL_REMINDER':
      return handleSubscriptionRenewalReminderTask(task);
    case 'JOB_AUTO_CLOSE':
      return handleJobAutoCloseTask(task);
    case 'EMAIL_RETRY':
      return handleEmailRetryTask(task);
    case 'NOTIFICATION_RETRY':
      return handleNotificationRetryTask(task);
    case 'INTELLIGENCE_EXECUTION':
      return handleIntelligenceExecutionTask(task);
    case 'CANDIDATE_INTELLIGENCE_GENERATION':
      return handleCandidateIntelligenceGenerationTask(task);
    case 'CANDIDATE_MATCH_GENERATION':
      return handleCandidateMatchGenerationTask(task);
    case 'CANDIDATE_MATCH_BULK_GENERATION':
      return handleCandidateMatchBulkGenerationTask(task);
    case 'JOB_CANDIDATE_RANKING_GENERATION':
      return handleJobCandidateRankingGenerationTask(task);
    case 'JOB_DESCRIPTION_GENERATION':
      return handleJobDescriptionGenerationTask(task);
    case 'DATA_EXPORT':
      return handleDataExportTask(task);
    case 'STALE_RESULT_CLEANUP':
      return handleCleanupTask(task);
    default:
      return 'cancelled';
  }
}
