import { prisma } from '../config/db.js';
import { serializeJobRequisition } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { createNotification } from './notificationService.js';
import { recordAuditLog } from './auditLogService.js';

function normalizeRequisitionData(payload) {
  return {
    requisitionCode: payload.requisitionCode,
    title: payload.title,
    department: payload.department || null,
    businessUnit: payload.businessUnit || null,
    location: payload.location || null,
    employmentType: payload.employmentType || null,
    numberOfOpenings: payload.numberOfOpenings ?? 1,
    hiringManagerId: payload.hiringManagerId || null,
    recruiterId: payload.recruiterId || null,
    priority: payload.priority || 'MEDIUM',
    targetHireDate: payload.targetHireDate ? new Date(payload.targetHireDate) : null,
    status: payload.status || undefined,
    reasonForHiring: payload.reasonForHiring || null,
    replacementFor: payload.replacementFor || null,
    budgetMin: payload.budgetMin ?? null,
    budgetMax: payload.budgetMax ?? null,
    currency: payload.currency || null,
    approvalStatus: payload.approvalStatus || undefined,
  };
}

async function getRequisitionOr404(organisationId, requisitionId) {
  const requisition = await prisma.jobRequisition.findFirst({
    where: { id: requisitionId, organisationId },
    include: {
      createdBy: true,
      approvedBy: true,
      recruiter: true,
      hiringManager: true,
    },
  });

  if (!requisition) {
    const error = new Error('Requisition not found.');
    error.statusCode = 404;
    throw error;
  }

  return requisition;
}

export async function createRequisition(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  const requisition = await prisma.jobRequisition.create({
    data: {
      organisationId: context.organisationId,
      createdById: actorUser.id,
      ...normalizeRequisitionData(payload),
    },
    include: {
      createdBy: true,
      approvedBy: true,
      recruiter: true,
      hiringManager: true,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'requisition.create',
    entityType: 'JobRequisition',
    entityId: requisition.id,
    afterData: requisition,
    ...requestMeta,
  });

  return serializeJobRequisition(requisition);
}

export async function listRequisitions(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const requisitions = await prisma.jobRequisition.findMany({
    where: { organisationId: context.organisationId },
    include: {
      createdBy: true,
      approvedBy: true,
      recruiter: true,
      hiringManager: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return requisitions.map(serializeJobRequisition);
}

export async function updateRequisition(actorUser, requisitionId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  const existing = await getRequisitionOr404(context.organisationId, requisitionId);

  const updated = await prisma.jobRequisition.update({
    where: { id: requisitionId },
    data: normalizeRequisitionData(payload),
    include: {
      createdBy: true,
      approvedBy: true,
      recruiter: true,
      hiringManager: true,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'requisition.update',
    entityType: 'JobRequisition',
    entityId: requisitionId,
    beforeData: existing,
    afterData: updated,
    ...requestMeta,
  });

  return serializeJobRequisition(updated);
}

export async function approveRequisition(actorUser, requisitionId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN'], organisationId);
  const existing = await getRequisitionOr404(context.organisationId, requisitionId);

  const updated = await prisma.jobRequisition.update({
    where: { id: requisitionId },
    data: {
      approvalStatus: payload.approvalStatus,
      status: payload.status || (payload.approvalStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED'),
      approvedById: actorUser.id,
      approvedAt: new Date(),
    },
    include: {
      createdBy: true,
      approvedBy: true,
      recruiter: true,
      hiringManager: true,
    },
  });

  if (updated.createdById !== actorUser.id) {
    await createNotification({
      organisationId: context.organisationId,
      recipientUserId: updated.createdById,
      type: 'REQUISITION',
      title: `Requisition ${payload.approvalStatus.toLowerCase()}`,
      message: `${updated.title} (${updated.requisitionCode}) was ${payload.approvalStatus.toLowerCase()}.`,
      entityType: 'JobRequisition',
      entityId: updated.id,
    });
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'requisition.approve',
    entityType: 'JobRequisition',
    entityId: requisitionId,
    beforeData: existing,
    afterData: updated,
    ...requestMeta,
  });

  return serializeJobRequisition(updated);
}
