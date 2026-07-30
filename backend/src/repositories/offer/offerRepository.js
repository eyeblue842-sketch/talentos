import crypto from 'crypto';
import { prisma } from '../../config/db.js';

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

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
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
        amount: component.amount == null || component.amount === '' ? null : Number(component.amount),
        frequency: component.frequency || null,
        taxable: component.taxable !== false,
        displayOrder: component.displayOrder ?? index + 1,
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

  if (offer.application?.submittedApplication?.id) {
    await tx.applicationTimeline.create({
      data: {
        organisationId: offer.organisationId,
        applicationId: offer.application.submittedApplication.id,
        eventType,
        message,
        metadata: {
          offerId: offer.id,
          offerReference: offer.referenceNumber,
          version: offer.version,
          ...metadata,
        },
        isCandidateVisible: candidateVisible,
      },
    });
  }
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
      revokedAt: null,
      consumedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export function findApplicationForOffer(organisationId, applicationId) {
  return prisma.application.findFirst({
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
}

export function findOfferByIdForOrganisation(organisationId, offerId) {
  return prisma.offer.findFirst({
    where: { id: offerId, organisationId },
    include: offerInclude,
  });
}

export async function expireOfferRecord(offer, applicationUpdate) {
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
}

export function findOfferAccessToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  return prisma.offerAccessToken.findUnique({
    where: { tokenHash },
    include: {
      offer: {
        include: offerInclude,
      },
    },
  });
}

export function findActiveOrganisationMemberships(organisationId, userIds) {
  return prisma.organisationMembership.findMany({
    where: {
      organisationId,
      userId: { in: userIds },
      status: 'ACTIVE',
    },
  });
}

export function createOfferDraftRecord({ referenceNumber, version, payload, offerData, application, actorUserId, activeReleasedStatuses }) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        referenceNumber,
        version,
        status: 'DRAFT',
        ...offerData,
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
        data: { currentStage: 'SELECTED', statusLabel: 'Offer Draft' },
      });
    }

    await createOfferActivity(tx, refreshed, 'OFFER_DRAFT_CREATED', `Offer draft ${refreshed.referenceNumber} was created.`, actorUserId, false);
    return refreshed;
  });
}

export function updateOfferDraftRecord({ existing, payload, offerData, actorUserId }) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.update({
      where: { id: existing.id },
      data: {
        ...offerData,
        createdByUserId: existing.createdByUserId,
      },
    });
    await replaceOfferChildren(tx, offer.id, payload);
    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_DRAFT_UPDATED', `Offer draft ${refreshed.referenceNumber} was updated.`, actorUserId, false);
    return refreshed;
  });
}

export function requestOfferApprovalRecord({ existing, approvals, actorUserId, applicationUpdate }) {
  return prisma.$transaction(async (tx) => {
    await tx.offerApproval.deleteMany({ where: { offerId: existing.id } });
    await tx.offerApproval.createMany({
      data: approvals.map((approval) => ({
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
        updatedByUserId: actorUserId,
      },
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: applicationUpdate,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_APPROVAL_REQUESTED', `Offer ${refreshed.referenceNumber} was submitted for approval.`, actorUserId, false);
    return refreshed;
  });
}

export function actOnOfferApprovalRecord({ existing, approval, action, comments, nextStatus, actorUserId, applicationUpdate }) {
  return prisma.$transaction(async (tx) => {
    await tx.offerApproval.update({
      where: { id: approval.id },
      data: {
        status: action,
        comments: comments || null,
        actedAt: new Date(),
      },
    });

    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        approvedAt: nextStatus === 'APPROVED' ? new Date() : null,
        updatedByUserId: actorUserId,
      },
    });

    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });

    await tx.application.update({
      where: { id: existing.applicationId },
      data: applicationUpdate,
    });

    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_APPROVAL_${action}`,
      `Offer ${refreshed.referenceNumber} approval step ${approval.sequence} was ${action.replaceAll('_', ' ').toLowerCase()}.`,
      actorUserId,
      false,
    );

    return refreshed;
  });
}

export function findConflictingReleasedOffer(applicationId, offerId, activeStatuses) {
  return prisma.offer.findFirst({
    where: {
      applicationId,
      id: { not: offerId },
      status: { in: [...activeStatuses] },
    },
  });
}

export function releaseOfferRecord({ existing, conflictingReleased, expiryAt, actorUserId, applicationUpdate }) {
  return prisma.$transaction(async (tx) => {
    let rawToken = null;

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
        releasedByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });

    await tx.application.update({
      where: { id: existing.applicationId },
      data: applicationUpdate,
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
      actorUserId,
      true,
    );

    return { offer: refreshed, rawToken };
  });
}

export function createOfferRevisionRecord({ referenceNumber, version, source, payload, offerData, application, actorUserId }) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        referenceNumber,
        version,
        status: 'DRAFT',
        previousOfferId: source.id,
        ...offerData,
      },
    });
    await replaceOfferChildren(tx, offer.id, payload);
    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_REVISION_CREATED', `Offer revision ${refreshed.referenceNumber} was created.`, actorUserId, false, {
      sourceOfferId: source.id,
      sourceReference: source.referenceNumber,
    });
    return refreshed;
  });
}

export function withdrawOfferRecord({ existing, reason, actorUserId, applicationUpdate }) {
  return prisma.$transaction(async (tx) => {
    await invalidateAccessTokens(tx, existing.id);
    await tx.offer.update({
      where: { id: existing.id },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        withdrawalReason: reason,
        updatedByUserId: actorUserId,
      },
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: applicationUpdate,
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await createOfferActivity(tx, refreshed, 'OFFER_WITHDRAWN', `Offer ${refreshed.referenceNumber} was withdrawn.`, actorUserId, true, {
      reason,
    });
    return refreshed;
  });
}

export function findCandidateOfferById(candidateId, offerId) {
  return prisma.offer.findFirst({
    where: {
      id: offerId,
      candidateId,
    },
    include: offerInclude,
  });
}

export function performCandidateOfferActionRecord({ offer, action, actorUserId = null, tokenId = null, payload = {}, applicationUpdate, candidateVisibleMessage }) {
  return prisma.$transaction(async (tx) => {
    if (tokenId) {
      await tx.offerAccessToken.update({
        where: { id: tokenId },
        data: {
          consumedAt: ['ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'].includes(action) ? new Date() : undefined,
        },
      });
    }

    const nextData = {
      updatedByUserId: actorUserId || offer.updatedByUserId,
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
          authorUserId: actorUserId || null,
          authorType: 'CANDIDATE',
          visibility: 'CANDIDATE',
          comment: payload.comment,
        },
      });
    }

    await tx.application.update({
      where: { id: offer.applicationId },
      data: applicationUpdate,
    });

    const refreshed = await tx.offer.findUnique({
      where: { id: offer.id },
      include: offerInclude,
    });

    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_${action}`,
      candidateVisibleMessage[action],
      actorUserId || null,
      true,
    );

    return refreshed;
  });
}

export function findCandidateOfferForApplicationRecord(candidateId, applicationId, statuses) {
  return prisma.offer.findFirst({
    where: {
      applicationId,
      candidateId,
      status: {
        in: statuses,
      },
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    include: offerInclude,
  });
}

export function updateJoiningLifecycleRecord({ existing, data, status, actorUserId, applicationUpdate, activityMessage, reason }) {
  return prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: existing.id },
      data,
    });
    await tx.application.update({
      where: { id: existing.applicationId },
      data: applicationUpdate,
    });
    const refreshed = await tx.offer.findUnique({
      where: { id: existing.id },
      include: offerInclude,
    });
    await createOfferActivity(
      tx,
      refreshed,
      `OFFER_${status}`,
      activityMessage,
      actorUserId,
      true,
      { reason: reason || null },
    );
    return refreshed;
  });
}
