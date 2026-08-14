import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { serializeJob } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { consumeJobCredit, getAvailableJobCredits } from './entitlementService.js';
import { isEntitlementEnforcementEnabled, shouldComputeShadowDecision, logEntitlementShadowDecision } from './billingRolloutService.js';
import { runSerializableTransaction } from '../utils/serializableTransaction.js';
import { addDays } from '../utils/dateUtils.js';

const JOB_ACTIVE_DAYS = 45;

const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
const readableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const assignableJobRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];

function buildJobWhere(organisationId, filters = {}) {
  return {
    organisationId,
    status: filters.status || undefined,
    title: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
  };
}

async function ensureOrganisationMember(client, organisationId, userId, allowedRoles) {
  if (!userId) return null;

  const membership = await client.organisationMembership.findFirst({
    where: {
      organisationId,
      userId,
      status: 'ACTIVE',
      role: { in: allowedRoles },
    },
    include: { user: true },
  });

  if (!membership) {
    const error = new Error('Selected organisation member is not eligible for this job assignment.');
    error.statusCode = 422;
    throw error;
  }

  return membership.user;
}

async function ensureApprovedRequisition(client, organisationId, requisitionId) {
  if (!requisitionId) return null;

  const requisition = await client.jobRequisition.findFirst({
    where: {
      id: requisitionId,
      organisationId,
      approvalStatus: 'APPROVED',
    },
  });

  if (!requisition) {
    const error = new Error('Approved requisition not found.');
    error.statusCode = 422;
    throw error;
  }

  return requisition;
}

async function ensureNoDuplicateRequisitionJob(client, organisationId, requisitionId) {
  if (!requisitionId) return;
  const existing = await client.job.findFirst({
    where: {
      organisationId,
      requisitionId,
      status: { in: ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED'] },
    },
  });

  if (existing) {
    const error = new Error('A job already exists for this requisition.');
    error.statusCode = 409;
    throw error;
  }
}

async function buildUniqueJobSlug(client, title, existingJobId = null) {
  const base = slugify(title, { lower: true, strict: true }) || `job-${Date.now()}`;
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await client.job.findUnique({ where: { slug } });
    if (!existing || existing.id === existingJobId) {
      return slug;
    }

    counter += 1;
    slug = `${base}-${counter}`;
  }
}

function normalizeJobPayload(payload) {
  return {
    title: payload.title,
    description: payload.description,
    skillsRequired: payload.skillsRequired,
    responsibilities: payload.responsibilities || [],
    requirements: payload.requirements || [],
    benefits: payload.benefits || [],
    applicationNotificationEmail: payload.applicationNotificationEmail || null,
    experienceMin: payload.experienceMin,
    experienceMax: payload.experienceMax,
    salaryMin: payload.salaryMin ?? null,
    salaryMax: payload.salaryMax ?? null,
    currency: payload.currency || null,
    isPublic: payload.isPublic ?? true,
    // Salary stays required internally (see jobCreateSchema/jobUpdateSchema); this
    // flag only controls whether serializePublicJob is allowed to expose it to
    // candidates. Defaults to visible - a job is only hidden when the recruiter
    // explicitly checks "Hide salary from candidates".
    publicSalaryEnabled: payload.publicSalaryEnabled ?? true,
    featuredInPortal: payload.featuredInPortal ?? false,
    visibility: payload.visibility || 'EXTERNAL',
    location: payload.location,
    employmentType: payload.employmentType || 'FULL_TIME',
    workplaceType: payload.workplaceType || null,
    numberOfOpenings: payload.numberOfOpenings ?? 1,
    department: payload.department || null,
    businessUnit: payload.businessUnit || null,
    requisitionId: payload.requisitionId || null,
    hiringManagerId: payload.hiringManagerId || null,
    recruiterId: payload.recruiterId || null,
    applicationDeadline: payload.applicationDeadline ? new Date(payload.applicationDeadline) : null,
    applicationOpensAt: payload.applicationOpensAt ? new Date(payload.applicationOpensAt) : null,
    applicationClosesAt: payload.applicationClosesAt
      ? new Date(payload.applicationClosesAt)
      : payload.applicationDeadline
        ? new Date(payload.applicationDeadline)
        : null,
    maxApplications: payload.maxApplications ?? null,
    targetHires: payload.targetHires ?? null,
    autoCloseOnTargetHire: payload.autoCloseOnTargetHire ?? false,
    status: payload.status,
    archivedAt: payload.status === 'ARCHIVED' ? new Date() : null,
  };
}

async function getJobById(organisationId, jobId) {
  return prisma.job.findFirst({
    where: { id: jobId, organisationId },
    include: {
      requisition: true,
      recruiter: true,
      hiringManager: true,
      screeningQuestions: { orderBy: { displayOrder: 'asc' } },
      _count: { select: { applications: true } },
    },
  });
}

async function assertOrganisationCanAccessJob(actorUser, jobId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const job = await getJobById(context.organisationId, jobId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return { context, job };
}

async function buildPipelineSummary(organisationId, jobId) {
  const grouped = await prisma.application.groupBy({
    by: ['currentStage'],
    where: { organisationId, jobId },
    _count: { currentStage: true },
  });

  return grouped.map((item) => ({
    stage: item.currentStage,
    count: item._count.currentStage,
  }));
}

function buildPaginatedMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const jobIncludes = {
  requisition: true,
  recruiter: true,
  hiringManager: true,
  screeningQuestions: { orderBy: { displayOrder: 'asc' } },
  _count: { select: { applications: true } },
};

// Section 10/B1-hardening-section-4: publishing (activating a job into
// OPEN) always converges on this one helper, called from inside the SAME
// transaction as job creation or job field updates - never as a separate
// step, and never reachable via any other code path. This is what makes
// "no alternate endpoint can activate a job without consuming a valid
// credit" true even though createJob/updateJob still accept `status` as an
// ordinary field (matching the existing recruiter job form, which submits
// status alongside every other field in one request).
//
// Respects the entitlement-enforcement rollout flag: when enforcement is
// disabled for this organisation, the credit check/consumption is skipped
// entirely (job activates exactly like the pre-billing codebase - no
// ledger row is written, so nothing needs to be reconciled later when
// enforcement is turned on), but the decision is still computed and logged
// in shadow mode.
async function activateJobInTransaction(tx, { organisationId, jobId, actorUserId }) {
  const enforced = isEntitlementEnforcementEnabled(organisationId);

  if (enforced) {
    const idempotencyKey = `job-publish:${jobId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    await consumeJobCredit(tx, { organisationId, jobId, actorUserId, idempotencyKey });
  } else if (shouldComputeShadowDecision()) {
    // Opt-in only (see billingRolloutService.shouldComputeShadowDecision) -
    // when this is off (the default), a job publish with enforcement
    // disabled performs no ledger/credit query at all, exactly matching
    // pre-billing behaviour.
    const availableCredits = await getAvailableJobCredits(organisationId, tx);
    logEntitlementShadowDecision({
      organisationId,
      feature: 'job-publish',
      jobId,
      state: availableCredits > 0 ? 'ACTIVE' : 'SUBSCRIPTION_REQUIRED',
      wouldBlock: availableCredits <= 0,
    });
  }

  const now = new Date();
  return { activatedAt: now, activeUntil: addDays(now, JOB_ACTIVE_DAYS), autoClosedAt: null };
}

export async function createJob(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, writableRoles, organisationId);
  const requestedStatus = payload.status || 'DRAFT';
  const isPublishing = requestedStatus === 'OPEN';

  let capturedRequisition = null;

  async function run(tx) {
    const recruiter = await ensureOrganisationMember(tx, context.organisationId, payload.recruiterId || actorUser.id, assignableJobRoles);
    const hiringManager = await ensureOrganisationMember(tx, context.organisationId, payload.hiringManagerId || null, ['OWNER', 'ADMIN', 'HIRING_MANAGER', 'RECRUITER']);
    const requisition = await ensureApprovedRequisition(tx, context.organisationId, payload.requisitionId || null);
    await ensureNoDuplicateRequisitionJob(tx, context.organisationId, requisition?.id || null);
    capturedRequisition = requisition;

    // Always created as DRAFT first, even when the form requested OPEN -
    // publishing is then a second, credit-checked write inside this SAME
    // transaction (see activateJobInTransaction), so a quota failure rolls
    // the whole creation back rather than leaving a half-created job.
    // recruiterId/hiringManagerId/requisitionId are re-asserted AFTER the
    // normalizeJobPayload spread (not just set once before it) because
    // normalizeJobPayload echoes back payload.recruiterId verbatim - if a
    // caller omits recruiterId and relies on the actorUser-id fallback
    // resolved above, the later spread would otherwise silently overwrite
    // the resolved id with null. Same pattern as updateJob below.
    const jobData = {
      organisationId: context.organisationId,
      slug: await buildUniqueJobSlug(tx, payload.title),
      ...normalizeJobPayload({ ...payload, status: 'DRAFT' }),
    };
    jobData.recruiterId = recruiter.id;
    jobData.hiringManagerId = hiringManager?.id || null;
    jobData.requisitionId = requisition?.id || null;

    const createdJob = await tx.job.create({ data: jobData, include: jobIncludes });

    let finalJob = createdJob;
    if (isPublishing) {
      const activation = await activateJobInTransaction(tx, { organisationId: context.organisationId, jobId: createdJob.id, actorUserId: actorUser.id });
      finalJob = await tx.job.update({
        where: { id: createdJob.id },
        data: { status: 'OPEN', ...activation },
        include: jobIncludes,
      });
    }

    await tx.auditLog.create({
      data: {
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: isPublishing ? 'job.create_and_publish' : 'job.create',
        entityType: 'Job',
        entityId: finalJob.id,
        afterData: finalJob,
        ipAddress: requestMeta.ipAddress || null,
        userAgent: requestMeta.userAgent || null,
      },
    });

    return finalJob;
  }

  const job = await (isPublishing ? runSerializableTransaction(prisma, run) : prisma.$transaction(run));

  if (capturedRequisition?.createdById && capturedRequisition.createdById !== actorUser.id) {
    await createNotification({
      organisationId: context.organisationId,
      recipientUserId: capturedRequisition.createdById,
      type: 'JOB',
      title: 'Job created from requisition',
      message: `${job.title} was created from requisition ${capturedRequisition.requisitionCode}.`,
      entityType: 'Job',
      entityId: job.id,
    });
  }

  return serializeJob(job, { includeRequisition: true });
}

export async function listRecruiterJobs(actorUser, filters = {}, organisationId = null) {
  let legacyArrayResponse = false;
  if (typeof filters === 'string' && organisationId === null) {
    organisationId = filters;
    filters = {};
    legacyArrayResponse = true;
  }
  const context = await requireOrganisationContext(actorUser, organisationId);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 10));
  const where = buildJobWhere(context.organisationId, filters);

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: jobIncludes,
    }),
  ]);

  const result = {
    items: jobs.map((job) => serializeJob(job, { includeRequisition: true })),
    meta: buildPaginatedMeta(total, page, pageSize),
  };
  return legacyArrayResponse ? result.items : result;
}

export async function getJobDetail(actorUser, jobId, organisationId = null) {
  const { context, job } = await assertOrganisationCanAccessJob(actorUser, jobId, organisationId);
  const pipelineSummary = await buildPipelineSummary(context.organisationId, jobId);
  return serializeJob(job, {
    includeRequisition: true,
    pipelineSummary,
  });
}

export async function updateJob(jobId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const { context, job: existing } = await assertOrganisationCanAccessJob(actorUser, jobId, organisationId);
  if (!writableRoles.includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to update this job.');
    error.statusCode = 403;
    throw error;
  }

  const isPublishing = payload.status === 'OPEN' && existing.status !== 'OPEN';

  async function run(tx) {
    const recruiter = await ensureOrganisationMember(tx, context.organisationId, payload.recruiterId || existing.recruiterId, assignableJobRoles);
    const hiringManager = await ensureOrganisationMember(tx, context.organisationId, payload.hiringManagerId ?? existing.hiringManagerId ?? null, ['OWNER', 'ADMIN', 'HIRING_MANAGER', 'RECRUITER']);
    const requisition = await ensureApprovedRequisition(tx, context.organisationId, payload.requisitionId ?? existing.requisitionId ?? null);

    const data = normalizeJobPayload({
      ...existing,
      ...payload,
      recruiterId: recruiter.id,
      hiringManagerId: hiringManager?.id || null,
      requisitionId: requisition?.id || null,
      status: payload.status || existing.status,
    });

    if (payload.title && payload.title !== existing.title) {
      data.slug = await buildUniqueJobSlug(tx, payload.title, existing.id);
    }
    data.recruiterId = recruiter.id;
    data.hiringManagerId = hiringManager?.id || null;
    data.requisitionId = requisition?.id || null;

    if (isPublishing) {
      const activation = await activateJobInTransaction(tx, { organisationId: context.organisationId, jobId, actorUserId: actorUser.id });
      Object.assign(data, activation);
    }

    const updatedJob = await tx.job.update({
      where: { id: jobId },
      data,
      include: jobIncludes,
    });

    await tx.auditLog.create({
      data: {
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: isPublishing ? 'job.publish' : 'job.update',
        entityType: 'Job',
        entityId: jobId,
        beforeData: existing,
        afterData: updatedJob,
        ipAddress: requestMeta.ipAddress || null,
        userAgent: requestMeta.userAgent || null,
      },
    });

    return updatedJob;
  }

  const job = isPublishing ? await runSerializableTransaction(prisma, run) : await prisma.$transaction(run);

  return serializeJob(job, { includeRequisition: true });
}

export async function updateJobStatus(jobId, actorUser, status, organisationId = null, requestMeta = {}) {
  return updateJob(jobId, actorUser, { status }, organisationId, requestMeta);
}

export async function deleteJob(jobId, actorUser, organisationId = null, requestMeta = {}) {
  const { context, job } = await assertOrganisationCanAccessJob(actorUser, jobId, organisationId);
  if (!['OWNER', 'ADMIN', 'RECRUITER'].includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to delete this job.');
    error.statusCode = 403;
    throw error;
  }

  await prisma.job.delete({ where: { id: jobId } });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job.delete',
    entityType: 'Job',
    entityId: jobId,
    beforeData: job,
    ...requestMeta,
  });

  return { deleted: true };
}

export async function browseJobs(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 10));
  const where = {
    status: 'OPEN',
    title: filters.keyword ? { contains: filters.keyword, mode: 'insensitive' } : undefined,
    location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
    skillsRequired: filters.skill ? { has: filters.skill } : undefined,
  };

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        organisation: true,
        requisition: true,
      },
    }),
  ]);

  return {
    items: jobs.map((job) => ({
      id: job.id,
      slug: job.slug,
      title: job.title,
      description: job.description,
      skillsRequired: job.skillsRequired,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      location: job.location,
      employmentType: job.employmentType,
      workplaceType: job.workplaceType,
      status: job.status,
      organisation: job.organisation ? { id: job.organisation.id, name: job.organisation.name, slug: job.organisation.slug } : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
    meta: buildPaginatedMeta(total, page, pageSize),
  };
}
