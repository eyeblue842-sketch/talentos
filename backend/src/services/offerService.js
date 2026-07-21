import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { generateOfferPdfBuffer } from './offerDocumentService.js';
import { sendOfferReleasedEmail, sendOfferStatusEmail } from './emailService.js';

const recruiterReadableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const recruiterWritableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
const mutableStatuses = new Set(['DRAFT', 'CHANGES_REQUESTED']);
const releaseReadyStatuses = new Set(['APPROVED']);
const candidateActionableStatuses = new Set(['RELEASED', 'VIEWED']);
const activeReleasedStatuses = new Set(['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'DEFERRED']);
const terminalStatuses = new Set(['REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED', 'JOINED', 'NO_SHOW']);

const offerInclude = {
  organisation: true,
  job: {
    include: {
      recruiter: true,
      hiringManager: true,
    },
  },
  candidate: {
    include: {
      user: true,
    },
  },
  application: {
    include: {
      submittedApplication: true,
      job: true,
      candidate: {
        include: {
          user: true,
        },
      },
    },
  },
  createdBy: true,
  updatedBy: true,
  releasedBy: true,
  components: {
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  },
  approvals: {
    include: {
      approver: true,
    },
    orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
  },
  comments: {
    include: {
      authorUser: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  accessTokens: {
    orderBy: { createdAt: 'desc' },
  },
  previousOffer: {
    select: {
      id: true,
      referenceNumber: true,
      version: true,
      status: true,
    },
  },
  supersededByOffer: {
    select: {
      id: true,
      referenceNumber: true,
      version: true,
      status: true,
    },
  },
};

function badRequest(message, code = 422) {
  const error = new Error(message);
  error.statusCode = code;
  return error;
}

function notFound(message = 'Offer not found.') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeDate(value) {
  return value ? new Date(value) : null;
}

function decimalOrNull(value) {
  if (value == null || value === '') return null;
  return Number(value);
}

function toPublicMoney(value) {
  return value == null ? null : Number(value);
}

function buildOfferReference(version) {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `OFR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${version}-${suffix}`;
}

function buildOfferLinkPath(rawToken) {
  return `/offers/access/${rawToken}`;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function buildOfferStatusLabel(status) {
  switch (status) {
    case 'DRAFT': return 'Offer Draft';
    case 'PENDING_APPROVAL': return 'Approval Pending';
    case 'CHANGES_REQUESTED': return 'Offer Changes Requested';
    case 'APPROVED': return 'Offer Approved';
    case 'RELEASED': return 'Offer Released';
    case 'VIEWED': return 'Offer Viewed';
    case 'ACCEPTED': return 'Offer Accepted';
    case 'REJECTED': return 'Offer Rejected';
    case 'WITHDRAWN': return 'Offer Withdrawn';
    case 'EXPIRED': return 'Offer Expired';
    case 'SUPERSEDED': return 'Offer Superseded';
    case 'JOINING_CONFIRMED': return 'Joining Confirmed';
    case 'JOINED': return 'Joined';
    case 'NO_SHOW': return 'No Show';
    case 'DEFERRED': return 'Joining Deferred';
    default: return 'Offer Update';
  }
}

function buildApplicationStageUpdate(status) {
  if (status === 'REJECTED' || status === 'WITHDRAWN' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return {
      currentStage: 'REJECTED',
      statusLabel: buildOfferStatusLabel(status),
    };
  }

  return {
    currentStage: 'SELECTED',
    statusLabel: buildOfferStatusLabel(status),
  };
}

function calculateTotalCompensation(payload) {
  const numericValues = [
    payload.fixedCompensation,
    payload.variableCompensation,
    payload.joiningBonus,
    payload.retentionBonus,
    payload.allowancesAmount,
    payload.otherCompensation,
  ].map(decimalOrNull).filter((value) => value != null);

  if (!numericValues.length && payload.annualCompensation == null) {
    return null;
  }

  if (payload.annualCompensation != null) {
    return Number(payload.annualCompensation);
  }

  return numericValues.reduce((total, value) => total + value, 0);
}

function nextOfferExpiry(offer, requestedExpiryAt = null) {
  if (requestedExpiryAt) {
    return new Date(requestedExpiryAt);
  }

  const days = Number(offer.offerExpiryDays || 7);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

function serializeOfferComment(comment, options = {}) {
  if (!comment) return null;
  const includeInternal = Boolean(options.includeInternal);
  if (!includeInternal && comment.visibility === 'INTERNAL') {
    return null;
  }

  return {
    id: comment.id,
    authorType: comment.authorType,
    visibility: comment.visibility,
    comment: comment.comment,
    createdAt: comment.createdAt?.toISOString?.() || comment.createdAt,
    author: comment.authorUser ? {
      id: comment.authorUser.id,
      email: comment.authorUser.email,
      role: comment.authorUser.role,
    } : null,
  };
}

function serializeOfferApproval(approval, options = {}) {
  if (!approval) return null;
  const candidateView = Boolean(options.candidateView);
  return {
    id: approval.id,
    sequence: approval.sequence,
    status: approval.status,
    comments: candidateView ? null : approval.comments,
    actedAt: approval.actedAt?.toISOString?.() || approval.actedAt,
    approver: approval.approver ? {
      id: approval.approver.id,
      email: candidateView ? undefined : approval.approver.email,
      role: approval.approver.role,
    } : null,
  };
}

function serializeOffer(offer, options = {}) {
  if (!offer) return null;
  const candidateView = Boolean(options.candidateView);
  const accessToken = !candidateView && options.includeAccessState
    ? offer.accessTokens.find((token) => !token.revokedAt && !token.consumedAt) || null
    : null;

  return {
    id: offer.id,
    organisationId: candidateView ? undefined : offer.organisationId,
    applicationId: offer.applicationId,
    jobId: offer.jobId,
    candidateId: candidateView ? undefined : offer.candidateId,
    referenceNumber: offer.referenceNumber,
    version: offer.version,
    status: offer.status,
    currency: offer.currency,
    annualCompensation: toPublicMoney(offer.annualCompensation),
    fixedCompensation: toPublicMoney(offer.fixedCompensation),
    variableCompensation: toPublicMoney(offer.variableCompensation),
    joiningBonus: toPublicMoney(offer.joiningBonus),
    retentionBonus: toPublicMoney(offer.retentionBonus),
    allowancesAmount: toPublicMoney(offer.allowancesAmount),
    otherCompensation: toPublicMoney(offer.otherCompensation),
    totalCompensation: toPublicMoney(offer.totalCompensation),
    benefitsSummary: offer.benefitsSummary,
    compensationNotes: offer.compensationNotes,
    proposedJoiningDate: offer.proposedJoiningDate?.toISOString?.() || offer.proposedJoiningDate,
    actualJoiningDate: offer.actualJoiningDate?.toISOString?.() || offer.actualJoiningDate,
    probationPeriodMonths: offer.probationPeriodMonths,
    noticeOrBuyoutNote: offer.noticeOrBuyoutNote,
    workMode: offer.workMode,
    workLocation: offer.workLocation,
    reportingManagerName: offer.reportingManagerName,
    departmentSnapshot: offer.departmentSnapshot,
    employmentTypeSnapshot: offer.employmentTypeSnapshot,
    recruiterNameSnapshot: candidateView ? undefined : offer.recruiterNameSnapshot,
    hiringManagerNameSnapshot: offer.hiringManagerNameSnapshot,
    offerExpiryDays: offer.offerExpiryDays,
    expiryAt: offer.expiryAt?.toISOString?.() || offer.expiryAt,
    approvalRequestedAt: offer.approvalRequestedAt?.toISOString?.() || offer.approvalRequestedAt,
    approvedAt: offer.approvedAt?.toISOString?.() || offer.approvedAt,
    releasedAt: offer.releasedAt?.toISOString?.() || offer.releasedAt,
    viewedAt: offer.viewedAt?.toISOString?.() || offer.viewedAt,
    acceptedAt: offer.acceptedAt?.toISOString?.() || offer.acceptedAt,
    rejectedAt: offer.rejectedAt?.toISOString?.() || offer.rejectedAt,
    withdrawnAt: offer.withdrawnAt?.toISOString?.() || offer.withdrawnAt,
    supersededAt: offer.supersededAt?.toISOString?.() || offer.supersededAt,
    joiningConfirmedAt: offer.joiningConfirmedAt?.toISOString?.() || offer.joiningConfirmedAt,
    deferredAt: offer.deferredAt?.toISOString?.() || offer.deferredAt,
    noShowAt: offer.noShowAt?.toISOString?.() || offer.noShowAt,
    revisionReason: candidateView ? undefined : offer.revisionReason,
    candidateResponseReason: offer.candidateResponseReason,
    withdrawalReason: candidateView ? undefined : offer.withdrawalReason,
    deferredReason: offer.deferredReason,
    noShowReason: offer.noShowReason,
    termsAndConditions: offer.termsAndConditions,
    internalNotes: candidateView ? undefined : offer.internalNotes,
    createdAt: offer.createdAt?.toISOString?.() || offer.createdAt,
    updatedAt: offer.updatedAt?.toISOString?.() || offer.updatedAt,
    previousOffer: offer.previousOffer || null,
    supersededByOffer: offer.supersededByOffer || null,
    candidate: offer.candidate ? {
      id: candidateView ? undefined : offer.candidate.id,
      fullName: offer.candidate.fullName,
      email: offer.candidate.user?.email,
      currentTitle: offer.candidate.currentTitle,
      location: offer.candidate.location,
    } : null,
    job: offer.job ? {
      id: offer.job.id,
      title: offer.job.title,
      department: offer.job.department,
      location: offer.job.location,
      employmentType: offer.job.employmentType,
      workplaceType: offer.job.workplaceType,
    } : null,
    organisation: offer.organisation ? {
      id: candidateView ? undefined : offer.organisation.id,
      name: offer.organisation.name,
      slug: candidateView ? undefined : offer.organisation.slug,
      logoUrl: offer.organisation.logoUrl,
    } : null,
    approvals: (offer.approvals || []).map((approval) => serializeOfferApproval(approval, { candidateView })),
    components: (offer.components || []).map((component) => ({
      id: component.id,
      type: component.type,
      label: component.label,
      amount: toPublicMoney(component.amount),
      frequency: component.frequency,
      taxable: component.taxable,
      displayOrder: component.displayOrder,
    })),
    comments: (offer.comments || [])
      .map((comment) => serializeOfferComment(comment, { includeInternal: !candidateView }))
      .filter(Boolean),
    pdfDownloadUrl: candidateView ? `/api/offers/candidate/${offer.id}/pdf` : `/api/offers/${offer.id}/pdf`,
    access: accessToken ? {
      expiresAt: accessToken.expiresAt?.toISOString?.() || accessToken.expiresAt,
      revokedAt: accessToken.revokedAt?.toISOString?.() || accessToken.revokedAt,
      consumedAt: accessToken.consumedAt?.toISOString?.() || accessToken.consumedAt,
    } : undefined,
  };
}

async function getApplicationForOffer(organisationId, applicationId) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, organisationId },
    include: {
      job: {
        include: {
          recruiter: true,
          hiringManager: true,
        },
      },
      candidate: {
        include: {
          user: true,
        },
      },
      submittedApplication: true,
      offers: {
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });

  if (!application) {
    throw notFound('Application not found.');
  }

  return application;
}

async function getOfferOrThrow(organisationId, offerId) {
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, organisationId },
    include: offerInclude,
  });

  if (!offer) {
    throw notFound();
  }

  return offer;
}

function validateOfferEligibility(application) {
  if (!application.job || !application.candidate) {
    throw badRequest('The application is missing candidate or job context.');
  }

  if (application.currentStage !== 'SELECTED') {
    throw badRequest('This application is not eligible for an offer yet.');
  }
}

async function expireOfferIfNeeded(offer, requestMeta = {}) {
  if (!offer?.expiryAt) return offer;
  if (!['RELEASED', 'VIEWED'].includes(offer.status)) return offer;
  if (offer.expiryAt.getTime() > Date.now()) return offer;

  const applicationUpdate = buildApplicationStageUpdate('EXPIRED');
  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offer.id },
      data: { status: 'EXPIRED' },
    });

    await tx.application.update({
      where: { id: offer.applicationId },
      data: applicationUpdate,
    });

    if (offer.application?.submittedApplication?.id) {
      await tx.applicationTimeline.create({
        data: {
          organisationId: offer.organisationId,
          applicationId: offer.application.submittedApplication.id,
          eventType: 'OFFER_EXPIRED',
          message: `The offer for ${offer.job.title} has expired.`,
          metadata: { offerId: offer.id, version: offer.version },
          isCandidateVisible: true,
        },
      });
    }

    await tx.applicationActivity.create({
      data: {
        organisationId: offer.organisationId,
        applicationId: offer.applicationId,
        eventType: 'OFFER_EXPIRED',
        message: `Offer ${offer.referenceNumber} expired.`,
        metadata: { offerId: offer.id, version: offer.version },
      },
    });
  });

  await recordAuditLog({
    organisationId: offer.organisationId,
    actorUserId: null,
    action: 'offer.expired',
    entityType: 'Offer',
    entityId: offer.id,
    beforeData: { status: offer.status },
    afterData: { status: 'EXPIRED' },
    ...requestMeta,
  });

  return getOfferOrThrow(offer.organisationId, offer.id);
}

function buildOfferData(payload, application, actorUser) {
  return {
    applicationId: application.id,
    organisationId: application.organisationId,
    jobId: application.jobId,
    candidateId: application.candidateId,
    currency: payload.currency,
    annualCompensation: decimalOrNull(payload.annualCompensation),
    fixedCompensation: decimalOrNull(payload.fixedCompensation),
    variableCompensation: decimalOrNull(payload.variableCompensation),
    joiningBonus: decimalOrNull(payload.joiningBonus),
    retentionBonus: decimalOrNull(payload.retentionBonus),
    allowancesAmount: decimalOrNull(payload.allowancesAmount),
    otherCompensation: decimalOrNull(payload.otherCompensation),
    totalCompensation: calculateTotalCompensation(payload),
    benefitsSummary: payload.benefitsSummary || null,
    compensationNotes: payload.compensationNotes || null,
    proposedJoiningDate: normalizeDate(payload.proposedJoiningDate),
    probationPeriodMonths: payload.probationPeriodMonths ?? null,
    noticeOrBuyoutNote: payload.noticeOrBuyoutNote || null,
    workMode: payload.workMode || application.job.workplaceType || null,
    workLocation: payload.workLocation || application.job.location || null,
    reportingManagerName: payload.reportingManagerName || application.job.hiringManager?.email || null,
    departmentSnapshot: application.job.department || null,
    employmentTypeSnapshot: application.job.employmentType || null,
    recruiterNameSnapshot: application.job.recruiter?.email || actorUser.email,
    hiringManagerNameSnapshot: application.job.hiringManager?.email || null,
    offerExpiryDays: payload.offerExpiryDays ?? 7,
    termsAndConditions: payload.termsAndConditions || null,
    internalNotes: payload.internalNotes || null,
    revisionReason: payload.revisionReason || null,
    createdByUserId: actorUser.id,
    updatedByUserId: actorUser.id,
  };
}

async function replaceOfferChildren(tx, offerId, payload) {
  await tx.offerComponent.deleteMany({ where: { offerId } });
  await tx.offerApproval.deleteMany({ where: { offerId } });

  if (payload.components?.length) {
    await tx.offerComponent.createMany({
      data: payload.components.map((component, index) => ({
        offerId,
        type: component.type,
        label: component.label,
        amount: decimalOrNull(component.amount),
        frequency: component.frequency || 'ONE_TIME',
        taxable: component.taxable !== false,
        displayOrder: component.displayOrder ?? index,
      })),
    });
  }

  if (payload.approvals?.length) {
    await tx.offerApproval.createMany({
      data: payload.approvals.map((approval) => ({
        offerId,
        approverUserId: approval.approverUserId,
        sequence: approval.sequence,
        status: 'PENDING',
      })),
    });
  }
}

async function createOfferActivity(tx, offer, eventType, message, actorUserId = null, candidateVisible = false, metadata = {}) {
  await tx.applicationActivity.create({
    data: {
      organisationId: offer.organisationId,
      applicationId: offer.applicationId,
      actorUserId,
      eventType,
      message,
      metadata: {
        offerId: offer.id,
        offerReference: offer.referenceNumber,
        version: offer.version,
        ...metadata,
      },
    },
  });

  if (candidateVisible && offer.application?.submittedApplication?.id) {
    await tx.applicationTimeline.create({
      data: {
        organisationId: offer.organisationId,
        applicationId: offer.application.submittedApplication.id,
        actorUserId,
        eventType,
        message,
        metadata: {
          offerId: offer.id,
          offerReference: offer.referenceNumber,
          version: offer.version,
          ...metadata,
        },
        isCandidateVisible: true,
      },
    });
  }
}

async function notifyOfferApprover(offer, approval) {
  if (!approval?.approverUserId) return;
  await createNotification({
    organisationId: offer.organisationId,
    recipientUserId: approval.approverUserId,
    type: 'APPLICATION',
    title: 'Offer approval pending',
    message: `${offer.candidate.fullName}'s offer for ${offer.job.title} is awaiting your approval.`,
    entityType: 'Offer',
    entityId: offer.id,
    metadata: {
      offerId: offer.id,
      applicationId: offer.applicationId,
      version: offer.version,
    },
  });
}

async function notifyCandidateOffer(offer, title, message) {
  if (!offer.candidate?.userId && !offer.candidate?.user?.id) return;
  await createNotification({
    organisationId: offer.organisationId,
    recipientUserId: offer.candidate.userId || offer.candidate.user?.id,
    type: 'APPLICATION',
    title,
    message,
    entityType: 'Offer',
    entityId: offer.id,
    metadata: {
      offerId: offer.id,
      applicationId: offer.applicationId,
      version: offer.version,
    },
  });
}

async function notifyRecruiterStakeholders(offer, title, message) {
  const recipientIds = new Set([
    offer.createdByUserId,
    offer.updatedByUserId,
    offer.job?.recruiterId,
    offer.job?.hiringManagerId,
  ].filter(Boolean));

  await Promise.all([...recipientIds].map((recipientUserId) => createNotification({
    organisationId: offer.organisationId,
    recipientUserId,
    type: 'APPLICATION',
    title,
    message,
    entityType: 'Offer',
    entityId: offer.id,
    metadata: {
      offerId: offer.id,
      applicationId: offer.applicationId,
      version: offer.version,
    },
  })));
}

async function createAccessToken(tx, offerId, expiresAt) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await tx.offerAccessToken.create({
    data: {
      offerId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });
  return rawToken;
}

async function invalidateAccessTokens(tx, offerId) {
  await tx.offerAccessToken.updateMany({
    where: {
      offerId,
      consumedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async function resolveOfferToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.offerAccessToken.findUnique({
    where: { tokenHash },
    include: {
      offer: {
        include: offerInclude,
      },
    },
  });

  if (!record) {
    throw notFound('Offer access link is invalid.');
  }

  if (record.revokedAt || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
    throw badRequest('Offer access link is no longer valid.', 410);
  }

  return record;
}

async function assertApprovalsValid(organisationId, approvals, actorUserId) {
  const seenSequences = new Set();
  const seenApprovers = new Set();
  for (const approval of approvals) {
    if (seenSequences.has(approval.sequence)) {
      throw badRequest('Approval sequence values must be unique.');
    }
    if (seenApprovers.has(approval.approverUserId)) {
      throw badRequest('An approver can only appear once in the approval chain.');
    }
    if (approval.approverUserId === actorUserId) {
      throw badRequest('Offer creators cannot approve their own offers.');
    }
    seenSequences.add(approval.sequence);
    seenApprovers.add(approval.approverUserId);
  }

  const memberships = await prisma.organisationMembership.findMany({
    where: {
      organisationId,
      userId: { in: approvals.map((approval) => approval.approverUserId) },
      status: 'ACTIVE',
    },
  });

  if (memberships.length !== approvals.length) {
    throw badRequest('All approvers must be active members of the organisation.');
  }
}

export async function createOfferDraft(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const application = await getApplicationForOffer(context.organisationId, payload.applicationId);
  validateOfferEligibility(application);

  const blockingDraft = application.offers.find((offer) => ['DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED'].includes(offer.status));
  if (blockingDraft) {
    throw badRequest('An in-progress offer already exists for this application.');
  }

  if (payload.approvals?.length) {
    await assertApprovalsValid(context.organisationId, payload.approvals, actorUser.id);
  }

  const version = (application.offers[0]?.version || 0) + 1;
  const created = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        referenceNumber: buildOfferReference(version),
        version,
        status: 'DRAFT',
        ...buildOfferData(payload, application, actorUser),
      },
    });

    await replaceOfferChildren(tx, offer.id, payload);

    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });

    const hasReleasedSibling = application.offers.some((existing) => activeReleasedStatuses.has(existing.status));
    if (!hasReleasedSibling) {
      await tx.application.update({
        where: { id: application.id },
        data: buildApplicationStageUpdate('DRAFT'),
      });
    }

    await createOfferActivity(tx, refreshed, 'OFFER_DRAFT_CREATED', `Offer draft ${refreshed.referenceNumber} was created.`, actorUser.id, false);
    return refreshed;
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.create',
    entityType: 'Offer',
    entityId: created.id,
    afterData: { offerId: created.id, version: created.version, status: created.status },
    ...requestMeta,
  });

  return serializeOffer(created, { includeAccessState: true });
}

export async function listOffersForApplication(actorUser, applicationId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const application = await getApplicationForOffer(context.organisationId, applicationId);
  const offers = await Promise.all(
    application.offers.map(async (row) => expireOfferIfNeeded(await getOfferOrThrow(context.organisationId, row.id), requestMeta))
  );
  return offers.map((offer) => serializeOffer(offer, { includeAccessState: true }));
}

export async function getOfferDetail(actorUser, offerId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const offer = await expireOfferIfNeeded(await getOfferOrThrow(context.organisationId, offerId), requestMeta);
  return serializeOffer(offer, { includeAccessState: true });
}

export async function updateOfferDraft(actorUser, offerId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await getOfferOrThrow(context.organisationId, offerId);

  if (!mutableStatuses.has(existing.status)) {
    throw badRequest('Only draft or changes-requested offers can be edited directly.');
  }

  if (payload.approvals?.length) {
    await assertApprovalsValid(context.organisationId, payload.approvals, existing.createdByUserId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.update({
      where: { id: existing.id },
      data: {
        ...buildOfferData(payload, existing.application, actorUser),
        createdByUserId: existing.createdByUserId,
      },
    });
    await replaceOfferChildren(tx, offer.id, payload);
    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_DRAFT_UPDATED', `Offer draft ${refreshed.referenceNumber} was updated.`, actorUser.id, false);
    return refreshed;
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.update',
    entityType: 'Offer',
    entityId: updated.id,
    beforeData: { status: existing.status },
    afterData: { status: updated.status, version: updated.version },
    ...requestMeta,
  });

  return serializeOffer(updated, { includeAccessState: true });
}

export async function requestOfferApproval(actorUser, offerId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await getOfferOrThrow(context.organisationId, offerId);

  if (!mutableStatuses.has(existing.status) && existing.status !== 'APPROVED') {
    throw badRequest('This offer cannot enter approval from its current state.');
  }

  await assertApprovalsValid(context.organisationId, payload.approvals, existing.createdByUserId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.offerApproval.deleteMany({ where: { offerId: existing.id } });
    await tx.offerApproval.createMany({
      data: payload.approvals.map((approval) => ({
        offerId: existing.id,
        approverUserId: approval.approverUserId,
        sequence: approval.sequence,
        status: 'PENDING',
      })),
    });
    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING_APPROVAL',
        approvalRequestedAt: new Date(),
        approvedAt: null,
        updatedByUserId: actorUser.id,
      },
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: buildApplicationStageUpdate('PENDING_APPROVAL'),
    });
    await createOfferActivity(tx, refreshed, 'OFFER_APPROVAL_REQUESTED', `Offer ${refreshed.referenceNumber} was submitted for approval.`, actorUser.id, false);
    return refreshed;
  });

  if (updated.approvals[0]) {
    await notifyOfferApprover(updated, updated.approvals[0]);
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.request-approval',
    entityType: 'Offer',
    entityId: updated.id,
    afterData: {
      status: updated.status,
      approvalCount: updated.approvals.length,
    },
    ...requestMeta,
  });

  return serializeOffer(updated, { includeAccessState: true });
}

export async function actOnOfferApproval(actorUser, offerId, approvalId, action, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const existing = await getOfferOrThrow(context.organisationId, offerId);

  if (existing.status !== 'PENDING_APPROVAL') {
    throw badRequest('This offer is not awaiting approval.');
  }

  const approval = existing.approvals.find((item) => item.id === approvalId);
  if (!approval) {
    throw notFound('Approval step not found.');
  }
  if (approval.approverUserId !== actorUser.id) {
    throw badRequest('You cannot act on another approver’s step.', 403);
  }
  if (approval.status !== 'PENDING') {
    throw badRequest('This approval step has already been completed.');
  }

  const priorPending = existing.approvals.find((item) => item.sequence < approval.sequence && item.status !== 'APPROVED');
  if (priorPending) {
    throw badRequest('Approval steps must be completed in sequence.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.offerApproval.update({
      where: { id: approval.id },
      data: {
        status: action,
        comments: payload.comments || null,
        actedAt: new Date(),
      },
    });

    let nextStatus = 'PENDING_APPROVAL';
    if (action === 'APPROVED') {
      const remaining = existing.approvals.filter((item) => item.id !== approval.id);
      const hasPending = remaining.some((item) => item.status === 'PENDING');
      nextStatus = hasPending ? 'PENDING_APPROVAL' : 'APPROVED';
    } else {
      nextStatus = 'CHANGES_REQUESTED';
    }

    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        approvedAt: nextStatus === 'APPROVED' ? new Date() : null,
        updatedByUserId: actorUser.id,
      },
    });

    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });

    await tx.application.update({
      where: { id: existing.applicationId },
      data: buildApplicationStageUpdate(nextStatus),
    });

    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_APPROVAL_${action}`,
      `Offer ${refreshed.referenceNumber} approval step ${approval.sequence} was ${action.replaceAll('_', ' ').toLowerCase()}.`,
      actorUser.id,
      false,
    );

    return refreshed;
  });

  if (action === 'APPROVED') {
    const nextApproval = updated.approvals.find((item) => item.status === 'PENDING');
    if (nextApproval) {
      await notifyOfferApprover(updated, nextApproval);
    } else {
      await notifyRecruiterStakeholders(updated, 'Offer approved', `${updated.referenceNumber} is now fully approved and ready for release.`);
    }
  } else {
    await notifyRecruiterStakeholders(updated, 'Offer changes requested', `${updated.referenceNumber} needs updates before it can be released.`);
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: `offer.approval.${action.toLowerCase()}`,
    entityType: 'Offer',
    entityId: updated.id,
    afterData: {
      status: updated.status,
      approvalId,
      comments: payload.comments || null,
    },
    ...requestMeta,
  });

  return serializeOffer(updated, { includeAccessState: true });
}

export async function releaseOffer(actorUser, offerId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const initialOffer = await getOfferOrThrow(context.organisationId, offerId);
  const existing = await expireOfferIfNeeded(initialOffer, requestMeta);

  if (!releaseReadyStatuses.has(existing.status)) {
    throw badRequest('This offer is not approved for release.');
  }
  if (existing.approvals.some((approval) => approval.status !== 'APPROVED')) {
    throw badRequest('All approval steps must be completed before release.');
  }

  const conflictingReleased = await prisma.offer.findFirst({
    where: {
      applicationId: existing.applicationId,
      id: { not: existing.id },
      status: { in: [...activeReleasedStatuses] },
    },
  });

  const expiryAt = nextOfferExpiry(existing, payload.expiryAt);
  let rawToken = null;

  const released = await prisma.$transaction(async (tx) => {
    if (conflictingReleased) {
      await tx.offer.update({
        where: { id: conflictingReleased.id },
        data: {
          status: 'SUPERSEDED',
          supersededAt: new Date(),
          supersededByOfferId: existing.id,
        },
      });
      await invalidateAccessTokens(tx, conflictingReleased.id);
    }

    await invalidateAccessTokens(tx, existing.id);
    rawToken = await createAccessToken(tx, existing.id, expiryAt);

    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: 'RELEASED',
        expiryAt,
        releasedAt: new Date(),
        releasedByUserId: actorUser.id,
        updatedByUserId: actorUser.id,
      },
    });

    await tx.application.update({
      where: { id: existing.applicationId },
      data: buildApplicationStageUpdate('RELEASED'),
    });

    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });

    await createOfferActivity(
      tx,
      refreshed,
      'OFFER_RELEASED',
      `Offer ${refreshed.referenceNumber} was released to the candidate.`,
      actorUser.id,
      true,
    );

    return refreshed;
  });

  const offerUrl = new URL(buildOfferLinkPath(rawToken), env.frontendUrl).toString();
  await Promise.all([
    notifyCandidateOffer(released, 'Offer released', `Your offer for ${released.job.title} is ready to review.`),
    notifyRecruiterStakeholders(released, 'Offer released', `${released.referenceNumber} was released to the candidate.`),
    sendOfferReleasedEmail({
      to: released.candidate.user?.email,
      candidateName: released.candidate.fullName,
      jobTitle: released.job.title,
      organisationName: released.organisation.name,
      offerUrl,
      expiryAt: released.expiryAt,
    }),
  ]);

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.release',
    entityType: 'Offer',
    entityId: released.id,
    afterData: {
      status: released.status,
      expiryAt: released.expiryAt,
    },
    ...requestMeta,
  });

  return serializeOffer(released, { includeAccessState: true });
}

export async function createOfferRevision(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const source = await getOfferOrThrow(context.organisationId, payload.sourceOfferId);
  source.status = (await expireOfferIfNeeded(source, requestMeta)).status;

  if (['ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'NO_SHOW'].includes(source.status)) {
    throw badRequest('Accepted or completed offers cannot be revised without a controlled correction flow.');
  }

  if (payload.approvals?.length) {
    await assertApprovalsValid(context.organisationId, payload.approvals, actorUser.id);
  }

  const application = await getApplicationForOffer(context.organisationId, source.applicationId);
  const version = Math.max(...application.offers.map((offer) => offer.version), 0) + 1;

  const revised = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        referenceNumber: buildOfferReference(version),
        version,
        status: 'DRAFT',
        previousOfferId: source.id,
        ...buildOfferData(payload, application, actorUser),
      },
    });
    await replaceOfferChildren(tx, offer.id, payload);
    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_REVISION_CREATED', `Offer revision ${refreshed.referenceNumber} was created.`, actorUser.id, false, {
      sourceOfferId: source.id,
      sourceReference: source.referenceNumber,
    });
    return refreshed;
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.revision.create',
    entityType: 'Offer',
    entityId: revised.id,
    afterData: {
      status: revised.status,
      sourceOfferId: source.id,
      version: revised.version,
    },
    ...requestMeta,
  });

  return serializeOffer(revised, { includeAccessState: true });
}

export async function withdrawOffer(actorUser, offerId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await expireOfferIfNeeded(await getOfferOrThrow(context.organisationId, offerId), requestMeta);

  if (terminalStatuses.has(existing.status) || existing.status === 'WITHDRAWN') {
    throw badRequest('This offer can no longer be withdrawn.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await invalidateAccessTokens(tx, existing.id);
    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        withdrawalReason: payload.reason,
        updatedByUserId: actorUser.id,
      },
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: buildApplicationStageUpdate('WITHDRAWN'),
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_WITHDRAWN', `Offer ${refreshed.referenceNumber} was withdrawn.`, actorUser.id, true, {
      reason: payload.reason,
    });
    return refreshed;
  });

  await Promise.all([
    notifyCandidateOffer(updated, 'Offer withdrawn', `Your offer for ${updated.job.title} has been withdrawn.`),
    notifyRecruiterStakeholders(updated, 'Offer withdrawn', `${updated.referenceNumber} was withdrawn.`),
    sendOfferStatusEmail(updated.candidate.user?.email, 'Offer withdrawn', `Your offer for ${updated.job.title} has been withdrawn by the employer.`),
  ]);

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.withdraw',
    entityType: 'Offer',
    entityId: updated.id,
    afterData: {
      status: updated.status,
      reason: payload.reason,
    },
    ...requestMeta,
  });

  return serializeOffer(updated, { includeAccessState: true });
}

async function getCandidateOfferOrThrow(candidateUser, offerId, requestMeta = {}) {
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      candidateId: candidateUser.candidateProfile.id,
    },
    include: offerInclude,
  });
  if (!offer) throw notFound();
  return expireOfferIfNeeded(offer, requestMeta);
}

async function performCandidateOfferAction({ offer, action, actorUser = null, tokenId = null, payload = {}, requestMeta = {} }) {
  const candidateVisibleMessage = {
    ACCEPTED: `You accepted the offer for ${offer.job.title}.`,
    REJECTED: `You rejected the offer for ${offer.job.title}.`,
    CHANGES_REQUESTED: `You requested changes for the offer for ${offer.job.title}.`,
    VIEWED: `You viewed the offer for ${offer.job.title}.`,
    JOINING_CONFIRMED: `Joining has been confirmed for ${offer.job.title}.`,
  };

  const updated = await prisma.$transaction(async (tx) => {
    if (tokenId) {
      await tx.offerAccessToken.update({
        where: { id: tokenId },
        data: {
          consumedAt: ['ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'].includes(action) ? new Date() : undefined,
        },
      });
    }

    const nextData = {
      updatedByUserId: actorUser?.id || offer.updatedByUserId,
    };

    if (action === 'VIEWED' && !offer.viewedAt) {
      nextData.status = 'VIEWED';
      nextData.viewedAt = new Date();
    } else if (action === 'ACCEPTED') {
      nextData.status = 'ACCEPTED';
      nextData.acceptedAt = new Date();
      nextData.candidateResponseReason = payload.comment || null;
    } else if (action === 'REJECTED') {
      nextData.status = 'REJECTED';
      nextData.rejectedAt = new Date();
      nextData.candidateResponseReason = payload.reason;
    } else if (action === 'CHANGES_REQUESTED') {
      nextData.status = 'CHANGES_REQUESTED';
      nextData.candidateResponseReason = payload.comment;
    }

    await tx.offer.update({
      where: { id: offer.id },
      data: nextData,
    });

    if (['ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED', 'VIEWED'].includes(action) && payload.comment) {
      await tx.offerComment.create({
        data: {
          offerId: offer.id,
          authorUserId: actorUser?.id || null,
          authorType: 'CANDIDATE',
          visibility: 'CANDIDATE',
          comment: payload.comment,
        },
      });
    }

    if (action === 'REJECTED') {
      await tx.application.update({
        where: { id: offer.applicationId },
        data: buildApplicationStageUpdate('REJECTED'),
      });
    } else if (action === 'ACCEPTED') {
      await tx.application.update({
        where: { id: offer.applicationId },
        data: buildApplicationStageUpdate('ACCEPTED'),
      });
    } else if (action === 'CHANGES_REQUESTED') {
      await tx.application.update({
        where: { id: offer.applicationId },
        data: buildApplicationStageUpdate('CHANGES_REQUESTED'),
      });
    } else if (action === 'VIEWED') {
      await tx.application.update({
        where: { id: offer.applicationId },
        data: buildApplicationStageUpdate('VIEWED'),
      });
    }

    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });

    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_${action}`,
      candidateVisibleMessage[action],
      actorUser?.id || null,
      true,
    );

    return refreshed;
  });

  await notifyRecruiterStakeholders(updated, `Offer ${action.toLowerCase().replaceAll('_', ' ')}`, `${updated.candidate.fullName} ${action.toLowerCase().replaceAll('_', ' ')} for ${updated.job.title}.`);

  await recordAuditLog({
    organisationId: updated.organisationId,
    actorUserId: actorUser?.id || null,
    action: `offer.candidate.${action.toLowerCase()}`,
    entityType: 'Offer',
    entityId: updated.id,
    afterData: { status: updated.status },
    ...requestMeta,
  });

  return updated;
}

export async function getCandidateOfferDetail(candidateUser, offerId, requestMeta = {}) {
  const offer = await getCandidateOfferOrThrow(candidateUser, offerId, requestMeta);
  return serializeOffer(offer, { candidateView: true });
}

export async function getCandidateOfferForApplication(candidateUser, applicationId, requestMeta = {}) {
  const offer = await prisma.offer.findFirst({
    where: {
      applicationId,
      candidateId: candidateUser.candidateProfile.id,
      status: {
        in: ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'DEFERRED', 'CHANGES_REQUESTED'],
      },
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    include: offerInclude,
  });
  if (!offer) return null;
  return serializeOffer(await expireOfferIfNeeded(offer, requestMeta), { candidateView: true });
}

export async function acceptCandidateOffer(candidateUser, offerId, payload, requestMeta = {}) {
  const offer = await getCandidateOfferOrThrow(candidateUser, offerId, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer cannot be accepted.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'ACCEPTED',
    actorUser: candidateUser,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function rejectCandidateOffer(candidateUser, offerId, payload, requestMeta = {}) {
  const offer = await getCandidateOfferOrThrow(candidateUser, offerId, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer cannot be rejected.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'REJECTED',
    actorUser: candidateUser,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function requestCandidateOfferRevision(candidateUser, offerId, payload, requestMeta = {}) {
  const offer = await getCandidateOfferOrThrow(candidateUser, offerId, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer cannot be revised in its current state.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'CHANGES_REQUESTED',
    actorUser: candidateUser,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function getOfferByToken(rawToken, requestMeta = {}) {
  const tokenRecord = await resolveOfferToken(rawToken);
  const offer = await expireOfferIfNeeded(tokenRecord.offer, requestMeta);

  if (offer.status === 'RELEASED') {
    const viewed = await performCandidateOfferAction({
      offer,
      action: 'VIEWED',
      tokenId: tokenRecord.id,
      payload: {},
      requestMeta,
    });
    return serializeOffer(viewed, { candidateView: true });
  }

  return serializeOffer(offer, { candidateView: true });
}

export async function acceptOfferByToken(rawToken, payload, requestMeta = {}) {
  const tokenRecord = await resolveOfferToken(rawToken);
  const offer = await expireOfferIfNeeded(tokenRecord.offer, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer can no longer be accepted.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'ACCEPTED',
    tokenId: tokenRecord.id,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function rejectOfferByToken(rawToken, payload, requestMeta = {}) {
  const tokenRecord = await resolveOfferToken(rawToken);
  const offer = await expireOfferIfNeeded(tokenRecord.offer, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer can no longer be rejected.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'REJECTED',
    tokenId: tokenRecord.id,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function requestOfferRevisionByToken(rawToken, payload, requestMeta = {}) {
  const tokenRecord = await resolveOfferToken(rawToken);
  const offer = await expireOfferIfNeeded(tokenRecord.offer, requestMeta);
  if (!candidateActionableStatuses.has(offer.status)) {
    throw badRequest('This offer can no longer receive revision requests.');
  }
  const updated = await performCandidateOfferAction({
    offer,
    action: 'CHANGES_REQUESTED',
    tokenId: tokenRecord.id,
    payload,
    requestMeta,
  });
  return serializeOffer(updated, { candidateView: true });
}

export async function updateJoiningLifecycle(actorUser, offerId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterWritableRoles, organisationId);
  const existing = await getOfferOrThrow(context.organisationId, offerId);

  if (!['ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED'].includes(existing.status) && payload.status !== 'JOINING_CONFIRMED') {
    throw badRequest('Joining lifecycle updates require an accepted offer.');
  }

  if (payload.status === 'JOINED' && !payload.actualJoiningDate) {
    throw badRequest('An actual joining date is required to mark the candidate as joined.');
  }
  if ((payload.status === 'DEFERRED' || payload.status === 'NO_SHOW') && !payload.reason) {
    throw badRequest('A reason is required for this joining outcome.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const data = {
      status: payload.status,
      updatedByUserId: actorUser.id,
      proposedJoiningDate: normalizeDate(payload.proposedJoiningDate) || existing.proposedJoiningDate,
      actualJoiningDate: normalizeDate(payload.actualJoiningDate) || existing.actualJoiningDate,
      joiningConfirmedAt: payload.status === 'JOINING_CONFIRMED' ? new Date() : existing.joiningConfirmedAt,
      deferredAt: payload.status === 'DEFERRED' ? new Date() : existing.deferredAt,
      noShowAt: payload.status === 'NO_SHOW' ? new Date() : existing.noShowAt,
      deferredReason: payload.status === 'DEFERRED' ? payload.reason : existing.deferredReason,
      noShowReason: payload.status === 'NO_SHOW' ? payload.reason : existing.noShowReason,
    };
    await tx.offer.update({
      where: { id: existing.id },
      data,
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: buildApplicationStageUpdate(payload.status),
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_${payload.status}`,
      `${buildOfferStatusLabel(payload.status)} recorded for ${refreshed.job.title}.`,
      actorUser.id,
      true,
      { reason: payload.reason || null },
    );
    return refreshed;
  });

  await Promise.all([
    notifyCandidateOffer(updated, buildOfferStatusLabel(payload.status), `Your hiring status for ${updated.job.title} is now ${buildOfferStatusLabel(payload.status)}.`),
    notifyRecruiterStakeholders(updated, buildOfferStatusLabel(payload.status), `${updated.candidate.fullName} is now ${buildOfferStatusLabel(payload.status)} for ${updated.job.title}.`),
  ]);

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'offer.joining.update',
    entityType: 'Offer',
    entityId: updated.id,
    afterData: {
      status: updated.status,
      reason: payload.reason || null,
      actualJoiningDate: updated.actualJoiningDate,
      proposedJoiningDate: updated.proposedJoiningDate,
    },
    ...requestMeta,
  });

  return serializeOffer(updated, { includeAccessState: true });
}

export async function getOfferPdfForRecruiter(actorUser, offerId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const offer = await expireOfferIfNeeded(await getOfferOrThrow(context.organisationId, offerId), requestMeta);
  return {
    filename: `${offer.referenceNumber.toLowerCase()}-v${offer.version}.pdf`,
    buffer: await generateOfferPdfBuffer(offer),
  };
}

export async function getOfferPdfForCandidate(candidateUser, offerId, requestMeta = {}) {
  const offer = await getCandidateOfferOrThrow(candidateUser, offerId, requestMeta);
  return {
    filename: `${offer.referenceNumber.toLowerCase()}-v${offer.version}.pdf`,
    buffer: await generateOfferPdfBuffer(offer),
  };
}

export async function getOfferPdfByToken(rawToken, requestMeta = {}) {
  const tokenRecord = await resolveOfferToken(rawToken);
  const offer = await expireOfferIfNeeded(tokenRecord.offer, requestMeta);
  return {
    filename: `${offer.referenceNumber.toLowerCase()}-v${offer.version}.pdf`,
    buffer: await generateOfferPdfBuffer(offer),
  };
}

export function getOfferAutomationStatus() {
  return {
    expiryProcessing: 'on-access-only',
    reminders: 'not-configured',
    joiningReminders: 'not-configured',
  };
}
