import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { serializeJob } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';

async function getJobById(organisationId, jobId) {
  return prisma.job.findFirst({
    where: { id: jobId, organisationId },
    include: { requisition: true },
  });
}

async function assertOrganisationCanAccessJob(actorUser, jobId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'], organisationId);
  const job = await getJobById(context.organisationId, jobId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return { context, job };
}

export async function createJob(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  const job = await prisma.job.create({
    data: {
      organisationId: context.organisationId,
      recruiterId: actorUser.id,
      requisitionId: payload.requisitionId || null,
      title: payload.title,
      slug: slugify(`${payload.title}-${Date.now()}`, { lower: true, strict: true }),
      description: payload.description,
      skillsRequired: payload.skillsRequired,
      experienceMin: payload.experienceMin,
      experienceMax: payload.experienceMax,
      salaryMin: payload.salaryMin,
      salaryMax: payload.salaryMax,
      location: payload.location,
      employmentType: payload.employmentType || 'FULL_TIME',
      status: payload.status || 'OPEN',
    },
    include: { requisition: true },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job.create',
    entityType: 'Job',
    entityId: job.id,
    afterData: job,
    ...requestMeta,
  });

  return serializeJob(job, { includeRequisition: true });
}

export async function listRecruiterJobs(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const jobs = await prisma.job.findMany({
    where: { organisationId: context.organisationId },
    orderBy: { createdAt: 'desc' },
    include: {
      requisition: true,
      _count: { select: { applications: true } },
    },
  });

  return jobs.map((job) => serializeJob(job, { includeRequisition: true }));
}

export async function updateJob(jobId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const { context, job: existing } = await assertOrganisationCanAccessJob(actorUser, jobId, organisationId);
  if (!['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to update this job.');
    error.statusCode = 403;
    throw error;
  }

  const job = await prisma.job.update({
    where: { id: jobId },
    data: payload,
    include: { requisition: true },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'job.update',
    entityType: 'Job',
    entityId: jobId,
    beforeData: existing,
    afterData: job,
    ...requestMeta,
  });

  return serializeJob(job, { includeRequisition: true });
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
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      title: filters.keyword ? { contains: filters.keyword, mode: 'insensitive' } : undefined,
      location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
      skillsRequired: filters.skill ? { has: filters.skill } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recruiter: { include: { recruiterProfile: { include: { organisation: true } } } },
      requisition: true,
    },
  });

  return jobs.map((job) => serializeJob(job, { publicRecruiter: true, includeRequisition: true }));
}
