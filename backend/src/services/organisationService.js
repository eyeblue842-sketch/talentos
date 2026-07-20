import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { serializeOrganisation, serializeOrganisationMembership } from '../serializers/index.js';
import { canManageMembers, requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { createNotification } from './notificationService.js';
import { recordAuditLog } from './auditLogService.js';

async function buildUniqueSlug(baseValue) {
  const base = slugify(baseValue, { lower: true, strict: true }) || `organisation-${Date.now()}`;
  let slug = base;
  let counter = 1;

  while (await prisma.organisation.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }

  return slug;
}

function normalizeOptionalString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normaliseProfileCompletion(payload) {
  return Boolean(
    payload.organisationName
    && payload.workspaceSlug
    && payload.industry
    && payload.companySize
    && payload.location
    && payload.designation
  );
}

export async function createOrganisationForUser(actorUser, payload, requestMeta = {}) {
  if (actorUser.role !== 'RECRUITER') {
    const error = new Error('Only recruiter users can create organisations.');
    error.statusCode = 403;
    throw error;
  }

  const organisation = await prisma.$transaction(async (tx) => {
    const created = await tx.organisation.create({
      data: {
        name: payload.name,
        slug: payload.slug || await buildUniqueSlug(payload.name),
        website: payload.website || null,
        logoUrl: payload.logoUrl || null,
      },
    });

    await tx.organisationMembership.create({
      data: {
        organisationId: created.id,
        userId: actorUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    if (actorUser.recruiterProfile && !actorUser.recruiterProfile.organisationId) {
      await tx.recruiterProfile.update({
        where: { userId: actorUser.id },
        data: { organisationId: created.id },
      });
    }

    return created;
  });

  await recordAuditLog({
    organisationId: organisation.id,
    actorUserId: actorUser.id,
    action: 'organisation.create',
    entityType: 'Organisation',
    entityId: organisation.id,
    afterData: organisation,
    ...requestMeta,
  });

  return serializeOrganisation(organisation);
}

export async function getCurrentOrganisation(actorUser, organisationId = null) {
  const { activeMembership } = await requireOrganisationContext(actorUser, organisationId);
  return serializeOrganisation(activeMembership.organisation);
}

export async function getRecruiterWorkspaceOnboarding(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: actorUser.id },
    include: { organisation: true },
  });

  if (!recruiterProfile) {
    const error = new Error('Recruiter profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    organisation: serializeOrganisation(context.activeMembership.organisation),
    recruiterProfile: {
      companyName: recruiterProfile.companyName,
      industryDomain: recruiterProfile.industryDomain,
      companySize: recruiterProfile.companySize,
      headquartersLocation: recruiterProfile.headquartersLocation,
      designation: recruiterProfile.designation,
      website: recruiterProfile.website,
      aboutCompany: recruiterProfile.aboutCompany,
      companyType: recruiterProfile.companyType,
      officeLocations: recruiterProfile.officeLocations || [],
      profileCompleted: recruiterProfile.profileCompleted,
    },
    onboardingCompleted: Boolean(recruiterProfile.profileCompleted),
    membershipRole: context.activeMembership.role,
  };
}

export async function completeRecruiterWorkspaceOnboarding(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'], organisationId);
  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: actorUser.id },
  });

  if (!recruiterProfile) {
    const error = new Error('Recruiter profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const existingOrganisation = await prisma.organisation.findUnique({
    where: { id: context.organisationId },
  });

  const requestedSlug = payload.workspaceSlug;
  if (requestedSlug && requestedSlug !== existingOrganisation.slug) {
    const slugOwner = await prisma.organisation.findUnique({ where: { slug: requestedSlug } });
    if (slugOwner && slugOwner.id !== existingOrganisation.id) {
      const error = new Error('Workspace slug is already in use.');
      error.statusCode = 409;
      throw error;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedOrganisation = await tx.organisation.update({
      where: { id: context.organisationId },
      data: {
        name: payload.organisationName,
        slug: payload.workspaceSlug || existingOrganisation.slug || await buildUniqueSlug(payload.organisationName),
        website: normalizeOptionalString(payload.companyWebsite),
        industry: payload.industry,
        organisationSize: payload.companySize,
        headquarters: payload.location,
      },
    });

    const updatedProfile = await tx.recruiterProfile.update({
      where: { userId: actorUser.id },
      data: {
        organisationId: context.organisationId,
        companyName: payload.organisationName,
        industryDomain: payload.industry,
        companySize: payload.companySize,
        headquartersLocation: payload.location,
        designation: payload.designation,
        website: normalizeOptionalString(payload.companyWebsite),
        profileCompleted: normaliseProfileCompletion(payload),
      },
    });

    return { updatedOrganisation, updatedProfile };
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'organisation.onboarding.complete',
    entityType: 'RecruiterProfile',
    entityId: recruiterProfile.id,
    beforeData: {
      organisationName: existingOrganisation.name,
      workspaceSlug: existingOrganisation.slug,
      website: existingOrganisation.website,
      industry: recruiterProfile.industryDomain,
      companySize: recruiterProfile.companySize,
      location: recruiterProfile.headquartersLocation,
      designation: recruiterProfile.designation,
      profileCompleted: recruiterProfile.profileCompleted,
    },
    afterData: {
      organisationName: result.updatedOrganisation.name,
      workspaceSlug: result.updatedOrganisation.slug,
      website: result.updatedOrganisation.website,
      industry: result.updatedProfile.industryDomain,
      companySize: result.updatedProfile.companySize,
      location: result.updatedProfile.headquartersLocation,
      designation: result.updatedProfile.designation,
      profileCompleted: result.updatedProfile.profileCompleted,
    },
    ...requestMeta,
  });

  return {
    organisation: serializeOrganisation(result.updatedOrganisation),
    recruiterProfile: {
      companyName: result.updatedProfile.companyName,
      industryDomain: result.updatedProfile.industryDomain,
      companySize: result.updatedProfile.companySize,
      headquartersLocation: result.updatedProfile.headquartersLocation,
      designation: result.updatedProfile.designation,
      website: result.updatedProfile.website,
      profileCompleted: result.updatedProfile.profileCompleted,
    },
    onboardingCompleted: Boolean(result.updatedProfile.profileCompleted),
  };
}

export async function listOrganisationMembers(actorUser, organisationId = null) {
  const { organisationId: activeOrganisationId } = await requireOrganisationContext(actorUser, organisationId);
  const memberships = await prisma.organisationMembership.findMany({
    where: { organisationId: activeOrganisationId },
    include: { organisation: true, user: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return memberships.map(serializeOrganisationMembership);
}

export async function addOrganisationMember(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN'], organisationId);
  const existingUser = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!existingUser) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const membership = await prisma.organisationMembership.upsert({
    where: {
      organisationId_userId: {
        organisationId: context.organisationId,
        userId: payload.userId,
      },
    },
    update: {
      role: payload.role,
      status: 'ACTIVE',
    },
    create: {
      organisationId: context.organisationId,
      userId: payload.userId,
      role: payload.role,
      status: 'ACTIVE',
    },
    include: {
      organisation: true,
      user: true,
    },
  });

  await Promise.all([
    createNotification({
      organisationId: context.organisationId,
      recipientUserId: payload.userId,
      type: 'MEMBERSHIP',
      title: 'Organisation membership updated',
      message: `You were added to ${membership.organisation.name} as ${payload.role}.`,
      entityType: 'OrganisationMembership',
      entityId: membership.id,
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.membership.upsert',
      entityType: 'OrganisationMembership',
      entityId: membership.id,
      afterData: membership,
      ...requestMeta,
    }),
  ]);

  return serializeOrganisationMembership(membership);
}

export async function updateOrganisationMember(actorUser, membershipId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, ['OWNER', 'ADMIN'], organisationId);
  const membership = await prisma.organisationMembership.findFirst({
    where: { id: membershipId, organisationId: context.organisationId },
    include: { organisation: true, user: true },
  });

  if (!membership) {
    const error = new Error('Membership not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!canManageMembers(context.activeMembership.role)) {
    const error = new Error('Insufficient organisation permissions.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.organisationMembership.update({
    where: { id: membershipId },
    data: {
      role: payload.role || undefined,
      status: payload.status || undefined,
    },
    include: { organisation: true, user: true },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'organisation.membership.update',
    entityType: 'OrganisationMembership',
    entityId: membershipId,
    beforeData: membership,
    afterData: updated,
    ...requestMeta,
  });

  return serializeOrganisationMembership(updated);
}
