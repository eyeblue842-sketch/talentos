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
import { assertOrganisationVerifiedForAction } from './organisationVerificationGate.js';

// Default Careeriz job validity: 31 calendar days from the FIRST successful
// publication. The first-publication date is authoritative and preserved
// across later edits/republishes (see activateJobInTransaction).
const JOB_ACTIVE_DAYS = 31;

class JobValidationError extends Error {
  constructor(message, code = 'JOB_VALIDATION_FAILED') {
    super(message);
    this.name = 'JobValidationError';
    this.statusCode = 422;
    this.code = code;
  }
}

// Computes the authoritative publish window, preserving the first-publication
// date. `current` carries the job's pre-activation state (activatedAt from a
// prior publish, plus the applicationOpensAt/applicationDeadline resolved from
// this request's payload). A recruiter-chosen deadline must be in the future
// and no later than firstPublishedAt + 31 days; when omitted it defaults to
// firstPublishedAt + 31 days. activeUntil (used by the auto-close scheduler)
// always equals the effective deadline.
export function resolvePublishWindow(current = {}, now = new Date()) {
  const firstPublishedAt = current.activatedAt ? new Date(current.activatedAt) : now;
  const defaultDeadline = addDays(firstPublishedAt, JOB_ACTIVE_DAYS);

  let applicationDeadline = current.applicationDeadline ? new Date(current.applicationDeadline) : null;
  if (applicationDeadline) {
    if (applicationDeadline.getTime() <= now.getTime()) {
      throw new JobValidationError('Application deadline must be a future date.', 'DEADLINE_IN_PAST');
    }
    if (applicationDeadline.getTime() > defaultDeadline.getTime()) {
      throw new JobValidationError(
        'Application deadline cannot be later than 31 days after the job is first published.',
        'DEADLINE_TOO_LATE',
      );
    }
  } else {
    applicationDeadline = defaultDeadline;
  }

  const applicationOpensAt = current.applicationOpensAt ? new Date(current.applicationOpensAt) : firstPublishedAt;

  return {
    activatedAt: firstPublishedAt,
    applicationOpensAt,
    applicationClosesAt: applicationDeadline,
    applicationDeadline,
    activeUntil: applicationDeadline,
    autoClosedAt: null,
  };
}

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

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// The set of emails Careeriz will accept as application-notification
// recipients for an organisation: every ACTIVE member whose user account is
// active. Returns a case-insensitive allow-set plus a canonical-casing map.
async function loadAuthorisedOrgEmails(client, organisationId) {
  const members = await client.organisationMembership.findMany({
    where: { organisationId, status: 'ACTIVE', user: { isActive: true } },
    select: { user: { select: { email: true } } },
  });
  const allowSet = new Set();
  const canonical = new Map();
  for (const member of members) {
    const email = member.user?.email;
    if (!email) continue;
    const key = normaliseEmail(email);
    if (!key) continue;
    allowSet.add(key);
    if (!canonical.has(key)) canonical.set(key, email.trim());
  }
  return { allowSet, canonical };
}

// Validates and normalises the application-notification recipients on
// create/edit/publish. Every address must be an authorised organisation-member
// email; arbitrary external addresses are rejected even when posted directly to
// the API. The primary is deduplicated out of the additional list (case-
// insensitively), and the additional list is de-duplicated within itself.
export async function buildNotificationRecipients(client, {
  organisationId,
  actorUser,
  primary,
  additional,
  requirePrimary = false,
  defaultPrimaryToActor = false,
}) {
  const { allowSet, canonical } = await loadAuthorisedOrgEmails(client, organisationId);

  let primaryEmail = primary != null && String(primary).trim() ? String(primary).trim() : null;
  if (!primaryEmail && defaultPrimaryToActor && actorUser?.email && allowSet.has(normaliseEmail(actorUser.email))) {
    primaryEmail = actorUser.email;
  }
  if (primaryEmail && !allowSet.has(normaliseEmail(primaryEmail))) {
    throw new JobValidationError('Choose an organisation-linked email for receiving applications.', 'RECEIVING_EMAIL_NOT_AUTHORISED');
  }
  if (requirePrimary && !primaryEmail) {
    throw new JobValidationError('Choose an organisation-linked email for receiving applications.', 'RECEIVING_EMAIL_REQUIRED');
  }
  const primaryCanonical = primaryEmail ? (canonical.get(normaliseEmail(primaryEmail)) || primaryEmail.trim()) : null;

  const seen = new Set(primaryCanonical ? [normaliseEmail(primaryCanonical)] : []);
  const additionalCanonical = [];
  for (const raw of Array.isArray(additional) ? additional : []) {
    const email = String(raw || '').trim();
    if (!email) continue;
    const key = normaliseEmail(email);
    if (!allowSet.has(key)) {
      throw new JobValidationError('Additional receiving emails must be organisation-linked addresses.', 'RECEIVING_EMAIL_NOT_AUTHORISED');
    }
    if (seen.has(key)) continue;
    seen.add(key);
    additionalCanonical.push(canonical.get(key) || email);
  }

  return { primary: primaryCanonical, additional: additionalCanonical };
}

// Send-time recipient resolution (req 8): re-validate the stored primary +
// additional emails against CURRENT active membership, so anyone who lost
// organisation access is excluded until reauthorised. De-duplicates so no
// recipient is delivered twice. Returns canonical addresses, primary first.
export async function resolveActiveNotificationRecipients(organisationId, { primary, additional } = {}, client = prisma) {
  if (!organisationId) return [];
  const { allowSet, canonical } = await loadAuthorisedOrgEmails(client, organisationId);
  const result = [];
  const seen = new Set();
  for (const raw of [primary, ...(Array.isArray(additional) ? additional : [])]) {
    const email = String(raw || '').trim();
    if (!email) continue;
    const key = normaliseEmail(email);
    if (!allowSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(canonical.get(key) || email);
  }
  return result;
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
    locations: payload.locations ?? [],
    candidateQualifications: payload.candidateQualifications ?? null,
    preferredCandidateProfile: payload.preferredCandidateProfile ?? null,
    employmentType: payload.employmentType || 'FULL_TIME',
    workplaceType: payload.workplaceType || null,
    numberOfOpenings: payload.numberOfOpenings ?? 1,
    department: payload.department || null,
    businessUnit: payload.businessUnit || null,
    isWalkIn: payload.isWalkIn ?? false,
    walkInStartDate: payload.walkInStartDate ? new Date(payload.walkInStartDate) : null,
    walkInEndDate: payload.walkInEndDate ? new Date(payload.walkInEndDate) : null,
    walkInTiming: payload.walkInTiming || null,
    walkInContactName: payload.walkInContactName || null,
    walkInContactPhone: payload.walkInContactPhone || null,
    walkInVenueAddress: payload.walkInVenueAddress || null,
    walkInGoogleMapsUrl: payload.walkInGoogleMapsUrl || null,
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
    // maxApplications is intentionally NOT written from the job form: Careeriz
    // does not stop accepting suitable candidates on an arbitrary count -
    // relevance/ranking surfaces stronger matches instead. The column remains
    // for legacy rows but is no longer set by create/publish.
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
// CAREERIZ EMPLOYER ACCESS, final publication-bypass closure section 1:
// the domain-verification check happens FIRST, before any entitlement
// query or credit consumption - a rejected publish must never consume a
// job credit or leave a partial write, and since this runs inside the
// SAME transaction as the caller's job create/update, throwing here rolls
// the whole thing back automatically. This is the converged boundary EVERY
// activation path goes through (createJob with status=OPEN, updateJob/
// updateJobStatus transitioning to OPEN, and job-description-draft
// publish, which itself calls updateJobStatus) - closing it here closes
// all of them at once, regardless of which route/payload shape reached it.
async function activateJobInTransaction(tx, { organisationId, jobId, actorUserId, organisation, current = {}, hasReceivingEmail = false }) {
  // Organisation-verification gate runs FIRST so an unverified/PENDING employer
  // is rejected for that reason regardless of deadline/email state.
  assertOrganisationVerifiedForAction(organisation, organisationId);

  // A publishable job must have an authorised receiving email (Part 17); this
  // is checked before any credit consumption so a rejected publish never spends
  // a job credit or leaves a partial write.
  if (!hasReceivingEmail) {
    throw new JobValidationError('Choose an organisation-linked email for receiving applications.', 'RECEIVING_EMAIL_REQUIRED');
  }

  // Publish-window validation runs before credit consumption too, for the same
  // reason - a rejected deadline never consumes a job credit.
  const publishWindow = resolvePublishWindow(current);

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

  return publishWindow;
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

    const recipients = await buildNotificationRecipients(tx, {
      organisationId: context.organisationId,
      actorUser,
      primary: payload.applicationNotificationEmail,
      additional: payload.applicationNotificationEmails,
      defaultPrimaryToActor: true,
    });
    jobData.applicationNotificationEmail = recipients.primary;
    jobData.applicationNotificationEmails = recipients.additional;

    const createdJob = await tx.job.create({ data: jobData, include: jobIncludes });

    let finalJob = createdJob;
    if (isPublishing) {
      const activation = await activateJobInTransaction(tx, {
        organisationId: context.organisationId,
        jobId: createdJob.id,
        actorUserId: actorUser.id,
        organisation: context.activeMembership.organisation,
        current: {
          activatedAt: createdJob.activatedAt,
          applicationOpensAt: createdJob.applicationOpensAt,
          applicationDeadline: createdJob.applicationDeadline,
        },
        hasReceivingEmail: Boolean(recipients.primary),
      });
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

    const recipients = await buildNotificationRecipients(tx, {
      organisationId: context.organisationId,
      actorUser,
      // Validate only what this request carries; unrelated edits keep the
      // stored recipients (which were validated when set). Send-time
      // re-validation still excludes anyone who has since lost access.
      primary: 'applicationNotificationEmail' in payload ? payload.applicationNotificationEmail : existing.applicationNotificationEmail,
      additional: 'applicationNotificationEmails' in payload ? payload.applicationNotificationEmails : existing.applicationNotificationEmails,
      defaultPrimaryToActor: false,
    });
    data.applicationNotificationEmail = recipients.primary;
    data.applicationNotificationEmails = recipients.additional;

    if (isPublishing) {
      const activation = await activateJobInTransaction(tx, {
        organisationId: context.organisationId,
        jobId,
        actorUserId: actorUser.id,
        organisation: context.activeMembership.organisation,
        current: {
          // existing.activatedAt preserves the authoritative first-publication
          // date across republishes; the deadline/opens come from this
          // request's resolved payload (data), so a recruiter can still tighten
          // the deadline on edit but never push the first-publish clock forward.
          activatedAt: existing.activatedAt,
          applicationOpensAt: data.applicationOpensAt,
          applicationDeadline: data.applicationDeadline,
        },
        hasReceivingEmail: Boolean(recipients.primary),
      });
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
