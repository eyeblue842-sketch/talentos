import slugify from 'slugify';
import { prisma } from '../config/db.js';
import {
  serializeAuditLog,
  serializeFeatureFlag,
  serializeNotificationTemplate,
  serializeOrganisation,
  serializeOrganisationMembership,
  serializeOrganisationRoleDefinition,
  serializeOrganisationSettings,
  serializeOrganisationUnit,
  serializeUser,
} from '../serializers/index.js';
import { recordAuditLog } from './auditLogService.js';
import {
  cloneDefaultPermissions,
  requireEnterprisePermission,
} from './enterprisePermissionService.js';
import { createOrganisationInvitation } from './organisationInvitationService.js';
import { getOrganisationAnalyticsMetrics } from '../intelligence/services/analyticsMetricsService.js';

function asNullOrTrimmed(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildPageMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function ensureUniqueOrganisationSlug(slug, organisationId = null) {
  if (!slug) return null;
  const normalized = slugify(slug, { lower: true, strict: true });
  const existing = await prisma.organisation.findUnique({ where: { slug: normalized } });
  if (existing && existing.id !== organisationId) {
    const error = new Error('Organisation slug is already in use.');
    error.statusCode = 409;
    throw error;
  }
  return normalized;
}

export async function ensureSystemRoleDefinitions(organisationId, client = prisma) {
  const definitions = await client.organisationRoleDefinition.findMany({
    where: { organisationId, archivedAt: null },
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
  });

  const systemRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
  const existingSlugs = new Set(definitions.map((item) => item.slug));
  const missing = systemRoles.filter((role) => !existingSlugs.has(role.toLowerCase()));

  if (!missing.length) {
    return definitions;
  }

  await client.organisationRoleDefinition.createMany({
    data: missing.map((role) => ({
      organisationId,
      name: role.replaceAll('_', ' '),
      slug: role.toLowerCase(),
      isSystem: true,
      baseRole: role,
      permissions: cloneDefaultPermissions(role),
    })),
  });

  return client.organisationRoleDefinition.findMany({
    where: { organisationId, archivedAt: null },
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function ensureOrganisationSettings(organisationId, updatedByUserId = null, client = prisma) {
  const existing = await client.organisationSettings.findUnique({
    where: { organisationId },
  });

  if (existing) return existing;

  return client.organisationSettings.create({
    data: {
      organisationId,
      employmentTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
      workModes: ['ONSITE', 'REMOTE', 'HYBRID'],
      experienceBands: [
        { label: '0-2 years', min: 0, max: 2 },
        { label: '3-5 years', min: 3, max: 5 },
        { label: '6-10 years', min: 6, max: 10 },
      ],
      defaultHiringWorkflow: {
        stages: ['Applied', 'Screening', 'Interview', 'Decision'],
      },
      defaultOfferWorkflow: {
        stages: ['Draft', 'Approval', 'Released', 'Accepted'],
      },
      interviewTemplates: [],
      offerTemplates: [],
      careerPageSettings: {},
      emailBranding: {},
      notificationDefaults: {},
      lookupSettings: {
        skills: [],
        locations: [],
        departments: [],
        employmentTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
        currencies: ['INR'],
        countries: ['India'],
        interviewTypes: ['HR', 'TECHNICAL', 'MANAGER', 'DIRECTOR', 'CLIENT', 'BEHAVIORAL', 'CUSTOM'],
        offerStatuses: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RELEASED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
        workflowStatuses: ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'JOINED', 'REJECTED'],
      },
      updatedByUserId,
    },
  });
}

function buildNotificationTemplatePreview(template, organisation) {
  return String(template.body || '')
    .replaceAll('{{organisation_name}}', organisation.name)
    .replaceAll('{{workspace_slug}}', organisation.slug);
}

export async function getEnterpriseAdminOverview(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'admin.dashboard.read', organisationId);

  const [organisation, settings, units, featureFlags, roleDefinitions, members, pendingInvitations, activeJobs, applications, interviews, offers, audits] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: context.organisationId } }),
    ensureOrganisationSettings(context.organisationId, actorUser.id),
    prisma.organisationUnit.findMany({ where: { organisationId: context.organisationId, archivedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.featureFlag.findMany({ where: { organisationId: context.organisationId }, orderBy: { key: 'asc' } }),
    ensureSystemRoleDefinitions(context.organisationId),
    prisma.organisationMembership.count({ where: { organisationId: context.organisationId, status: 'ACTIVE' } }),
    prisma.organisationInvitation.count({ where: { organisationId: context.organisationId, status: 'PENDING', expiresAt: { gt: new Date() } } }),
    prisma.job.count({ where: { organisationId: context.organisationId, status: { in: ['OPEN', 'ON_HOLD'] } } }),
    prisma.application.count({ where: { organisationId: context.organisationId } }),
    prisma.interviewRound.count({ where: { organisationId: context.organisationId } }),
    prisma.offer.count({ where: { organisationId: context.organisationId } }),
    prisma.auditLog.count({ where: { organisationId: context.organisationId } }),
  ]);

  return {
    organisation: serializeOrganisation(organisation),
    permissions: context.permissions,
    metrics: {
      activeMembers: members,
      pendingInvitations,
      activeJobs,
      applications,
      interviews,
      offers,
      auditEvents: audits,
      featureFlags: featureFlags.length,
      customRoles: roleDefinitions.filter((item) => !item.isSystem).length,
      structureNodes: units.length,
    },
    settings: serializeOrganisationSettings(settings),
  };
}

export async function getAdminOrganisationProfile(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.profile.manage', organisationId);
  const [organisation, units, settings] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: context.organisationId } }),
    prisma.organisationUnit.findMany({ where: { organisationId: context.organisationId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    ensureOrganisationSettings(context.organisationId, actorUser.id),
  ]);

  return {
    organisation: serializeOrganisation(organisation),
    units: units.map(serializeOrganisationUnit),
    settings: serializeOrganisationSettings(settings),
  };
}

export async function updateAdminOrganisationProfile(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.profile.manage', organisationId);
  const existing = await prisma.organisation.findUnique({ where: { id: context.organisationId } });
  const slug = await ensureUniqueOrganisationSlug(payload.slug, context.organisationId);

  const updated = await prisma.organisation.update({
    where: { id: context.organisationId },
    data: {
      name: payload.name || undefined,
      slug: slug || undefined,
      website: payload.website === '' ? null : payload.website ?? undefined,
      logoUrl: payload.logoUrl === '' ? null : payload.logoUrl ?? undefined,
      publicDescription: payload.publicDescription === '' ? null : payload.publicDescription ?? undefined,
      industry: payload.industry === '' ? null : payload.industry ?? undefined,
      organisationSize: payload.organisationSize === '' ? null : payload.organisationSize ?? undefined,
      headquarters: payload.headquarters === '' ? null : payload.headquarters ?? undefined,
      publicLocations: payload.publicLocations || undefined,
      cultureSummary: payload.cultureSummary === '' ? null : payload.cultureSummary ?? undefined,
      benefitsSummary: payload.benefitsSummary === '' ? null : payload.benefitsSummary ?? undefined,
      careersEnabled: payload.careersEnabled ?? undefined,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.organisation.profile.update',
    entityType: 'Organisation',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisation(updated);
}

export async function archiveOrRestoreOrganisation(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.profile.manage', organisationId);
  const existing = await prisma.organisation.findUnique({ where: { id: context.organisationId } });
  const nextStatus = payload.restore ? 'ACTIVE' : 'INACTIVE';

  const updated = await prisma.organisation.update({
    where: { id: context.organisationId },
    data: { status: nextStatus },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: payload.restore ? 'admin.organisation.restore' : 'admin.organisation.archive',
    entityType: 'Organisation',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisation(updated);
}

export async function createOrUpdateOrganisationUnit(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.structure.manage', organisationId);
  const existing = payload.id
    ? await prisma.organisationUnit.findFirst({ where: { id: payload.id, organisationId: context.organisationId } })
    : null;

  const unit = existing
    ? await prisma.organisationUnit.update({
        where: { id: existing.id },
        data: {
          type: payload.type,
          name: payload.name,
          code: asNullOrTrimmed(payload.code),
          description: asNullOrTrimmed(payload.description),
          parentId: payload.parentId || null,
          metadata: payload.metadata || {},
          archivedAt: null,
          status: 'ACTIVE',
        },
      })
    : await prisma.organisationUnit.create({
        data: {
          organisationId: context.organisationId,
          type: payload.type,
          name: payload.name,
          code: asNullOrTrimmed(payload.code),
          description: asNullOrTrimmed(payload.description),
          parentId: payload.parentId || null,
          metadata: payload.metadata || {},
        },
      });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: existing ? 'admin.organisation-unit.update' : 'admin.organisation-unit.create',
    entityType: 'OrganisationUnit',
    entityId: unit.id,
    beforeData: existing,
    afterData: unit,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisationUnit(unit);
}

export async function archiveOrRestoreOrganisationUnit(actorUser, unitId, restore = false, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.structure.manage', organisationId);
  const existing = await prisma.organisationUnit.findFirst({ where: { id: unitId, organisationId: context.organisationId } });
  if (!existing) {
    const error = new Error('Organisation unit not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.organisationUnit.update({
    where: { id: unitId },
    data: {
      archivedAt: restore ? null : new Date(),
      status: restore ? 'ACTIVE' : 'INACTIVE',
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: restore ? 'admin.organisation-unit.restore' : 'admin.organisation-unit.archive',
    entityType: 'OrganisationUnit',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisationUnit(updated);
}

export async function listEnterpriseUsers(actorUser, filters = {}, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.users.read', organisationId);
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 20)));
  const search = String(filters.search || '').trim();
  const where = {
    organisationId: context.organisationId,
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    user: {
      ...(filters.accountStatus ? { accountStatus: filters.accountStatus } : {}),
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.organisationMembership.count({ where }),
    prisma.organisationMembership.findMany({
      where,
      include: {
        organisation: true,
        user: {
          include: {
            recruiterProfile: { include: { organisation: true } },
            candidateProfile: true,
          },
        },
        customRoleDefinition: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map((membership) => ({
      membership: serializeOrganisationMembership(membership),
      user: serializeUser(membership.user, { includePrivate: true, activeMembership: membership }),
    })),
    meta: buildPageMeta(total, page, pageSize),
  };
}

export async function updateEnterpriseUserMembership(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.users.manage', organisationId);
  const existing = await prisma.organisationMembership.findFirst({
    where: { id: payload.membershipId, organisationId: context.organisationId },
    include: { user: true, customRoleDefinition: true },
  });

  if (!existing) {
    const error = new Error('Membership not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const membership = await tx.organisationMembership.update({
      where: { id: existing.id },
      data: {
        role: payload.role || undefined,
        customRoleDefinitionId: payload.customRoleDefinitionId === undefined ? undefined : payload.customRoleDefinitionId,
        status: payload.status || undefined,
      },
      include: { organisation: true, user: true, customRoleDefinition: true },
    });

    if (payload.accountStatus || payload.status) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          accountStatus: payload.accountStatus || undefined,
          isActive: payload.accountStatus ? payload.accountStatus === 'ACTIVE' : payload.status ? payload.status === 'ACTIVE' : undefined,
        },
      });
    }

    return membership;
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.membership.update',
    entityType: 'OrganisationMembership',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisationMembership(updated);
}

export async function transferOrganisationOwnership(actorUser, membershipId, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.users.transfer_ownership', organisationId);
  const target = await prisma.organisationMembership.findFirst({
    where: { id: membershipId, organisationId: context.organisationId },
  });

  if (!target) {
    const error = new Error('Membership not found.');
    error.statusCode = 404;
    throw error;
  }

  const owners = await prisma.organisationMembership.findMany({
    where: { organisationId: context.organisationId, role: 'OWNER' },
  });

  await prisma.$transaction(async (tx) => {
    for (const owner of owners) {
      await tx.organisationMembership.update({
        where: { id: owner.id },
        data: { role: owner.id === target.id ? 'OWNER' : 'ADMIN' },
      });
    }
    if (!owners.some((item) => item.id === target.id)) {
      await tx.organisationMembership.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      });
    }
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.organisation.transfer-ownership',
    entityType: 'OrganisationMembership',
    entityId: membershipId,
    metadata: { membershipId },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { transferred: true };
}

export async function bulkInviteEnterpriseUsers(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.users.manage', organisationId);
  const results = [];
  for (const invitation of payload.invitations) {
    try {
      const created = await createOrganisationInvitation(actorUser, invitation, context.organisationId, requestMeta);
      results.push({ email: invitation.email, success: true, invitation: created });
    } catch (error) {
      results.push({ email: invitation.email, success: false, message: error.message });
    }
  }
  return results;
}

export async function bulkUpdateEnterpriseUsers(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.users.manage', organisationId);
  const results = [];
  for (const membershipId of payload.membershipIds) {
    try {
      const updated = await updateEnterpriseUserMembership(actorUser, {
        membershipId,
        role: payload.role,
        customRoleDefinitionId: payload.customRoleDefinitionId,
        status: payload.status,
        accountStatus: payload.accountStatus,
      }, context.organisationId, requestMeta);
      results.push({ membershipId, success: true, membership: updated });
    } catch (error) {
      results.push({ membershipId, success: false, message: error.message });
    }
  }
  return results;
}

export async function listRoleDefinitions(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.roles.read', organisationId);
  const definitions = await ensureSystemRoleDefinitions(context.organisationId);
  return definitions.map(serializeOrganisationRoleDefinition);
}

export async function createOrUpdateRoleDefinition(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.roles.manage', organisationId);
  await ensureSystemRoleDefinitions(context.organisationId);
  const existing = payload.id
    ? await prisma.organisationRoleDefinition.findFirst({ where: { id: payload.id, organisationId: context.organisationId } })
    : null;

  const slug = payload.slug || slugify(payload.name, { lower: true, strict: true });

  const roleDefinition = existing
    ? await prisma.organisationRoleDefinition.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          slug,
          description: asNullOrTrimmed(payload.description),
          baseRole: payload.baseRole || undefined,
          permissions: payload.permissions,
          updatedByUserId: actorUser.id,
          archivedAt: null,
        },
      })
    : await prisma.organisationRoleDefinition.create({
        data: {
          organisationId: context.organisationId,
          name: payload.name,
          slug,
          description: asNullOrTrimmed(payload.description),
          baseRole: payload.baseRole || null,
          permissions: payload.cloneFromRoleDefinitionId
            ? (await prisma.organisationRoleDefinition.findFirst({
                where: { id: payload.cloneFromRoleDefinitionId, organisationId: context.organisationId },
                select: { permissions: true },
              }))?.permissions || payload.permissions
            : payload.permissions,
          createdByUserId: actorUser.id,
          updatedByUserId: actorUser.id,
        },
      });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: existing ? 'admin.role-definition.update' : 'admin.role-definition.create',
    entityType: 'OrganisationRoleDefinition',
    entityId: roleDefinition.id,
    beforeData: existing,
    afterData: roleDefinition,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisationRoleDefinition(roleDefinition);
}

export async function getOrganisationSettingsAdmin(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.settings.manage', organisationId);
  const settings = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  return serializeOrganisationSettings(settings);
}

export async function updateOrganisationSettingsAdmin(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.settings.manage', organisationId);
  const existing = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  const updated = await prisma.organisationSettings.update({
    where: { organisationId: context.organisationId },
    data: {
      timezone: payload.timezone ?? undefined,
      currency: payload.currency ?? undefined,
      language: payload.language ?? undefined,
      dateFormat: payload.dateFormat ?? undefined,
      employmentTypes: payload.employmentTypes ?? undefined,
      workModes: payload.workModes ?? undefined,
      experienceBands: payload.experienceBands ?? undefined,
      interviewSchedulingSettings: payload.interviewSchedulingSettings ?? undefined,
      careerPageSettings: payload.careerPageSettings ?? undefined,
      emailBranding: payload.emailBranding ?? undefined,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.organisation-settings.update',
    entityType: 'OrganisationSettings',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeOrganisationSettings(updated);
}

export async function getWorkflowAdministration(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.workflow.manage', organisationId);
  const settings = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  return {
    defaultHiringWorkflow: settings.defaultHiringWorkflow || {},
    defaultOfferWorkflow: settings.defaultOfferWorkflow || {},
    interviewTemplates: settings.interviewTemplates || [],
    offerTemplates: settings.offerTemplates || [],
    notificationDefaults: settings.notificationDefaults || {},
    applicationStages: settings.defaultHiringWorkflow?.applicationStages || [],
    interviewPipeline: settings.defaultHiringWorkflow?.interviewPipeline || [],
    recruitmentTemplates: settings.defaultHiringWorkflow?.recruitmentTemplates || [],
  };
}

export async function updateWorkflowAdministration(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.workflow.manage', organisationId);
  const existing = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  const updated = await prisma.organisationSettings.update({
    where: { organisationId: context.organisationId },
    data: {
      defaultHiringWorkflow: {
        ...(existing.defaultHiringWorkflow || {}),
        ...(payload.defaultHiringWorkflow || {}),
        ...(payload.applicationStages ? { applicationStages: payload.applicationStages } : {}),
        ...(payload.interviewPipeline ? { interviewPipeline: payload.interviewPipeline } : {}),
        ...(payload.recruitmentTemplates ? { recruitmentTemplates: payload.recruitmentTemplates } : {}),
      },
      defaultOfferWorkflow: payload.defaultOfferWorkflow ?? undefined,
      interviewTemplates: payload.interviewTemplates ?? undefined,
      offerTemplates: payload.offerTemplates ?? undefined,
      notificationDefaults: payload.defaultNotifications ?? undefined,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.workflow.update',
    entityType: 'OrganisationSettings',
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return getWorkflowAdministration(actorUser, context.organisationId);
}

export async function listAdminAuditLogs(actorUser, filters = {}, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.audit.read', organisationId);
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const where = {
    organisationId: context.organisationId,
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.from || filters.to ? {
      createdAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    } : {}),
    ...(filters.search ? {
      OR: [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actorUser: true },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      ...serializeAuditLog(row),
      actorUser: row.actorUser ? { id: row.actorUser.id, email: row.actorUser.email, role: row.actorUser.role } : null,
    })),
    meta: buildPageMeta(total, page, pageSize),
  };
}

export async function listNotificationTemplatesAdmin(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.notifications.manage', organisationId);
  const organisation = await prisma.organisation.findUnique({ where: { id: context.organisationId } });
  const templates = await prisma.notificationTemplate.findMany({
    where: { organisationId: context.organisationId },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });

  return templates.map((template) => ({
    ...serializeNotificationTemplate(template),
    preview: buildNotificationTemplatePreview(template, organisation),
  }));
}

export async function createOrUpdateNotificationTemplateAdmin(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.notifications.manage', organisationId);
  const existing = payload.id
    ? await prisma.notificationTemplate.findFirst({ where: { id: payload.id, organisationId: context.organisationId } })
    : null;

  const template = existing
    ? await prisma.notificationTemplate.update({
        where: { id: existing.id },
        data: {
          key: payload.key,
          category: payload.category,
          channel: payload.channel,
          subject: payload.subject,
          body: payload.body,
          enabled: payload.enabled ?? undefined,
          updatedByUserId: actorUser.id,
        },
      })
    : await prisma.notificationTemplate.create({
        data: {
          organisationId: context.organisationId,
          key: payload.key,
          category: payload.category,
          channel: payload.channel,
          subject: payload.subject,
          body: payload.body,
          enabled: payload.enabled ?? true,
          updatedByUserId: actorUser.id,
        },
      });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: existing ? 'admin.notification-template.update' : 'admin.notification-template.create',
    entityType: 'NotificationTemplate',
    entityId: template.id,
    beforeData: existing,
    afterData: template,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeNotificationTemplate(template);
}

export async function getBackgroundJobsDashboard(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'admin.dashboard.read', organisationId);
  const now = new Date();
  const soon = new Date(now.getTime() + (24 * 60 * 60 * 1000));

  const [resumeParsing, offerExpiry, interviewReminders, emailBacklog, taskSummary] = await Promise.all([
    prisma.resumeAsset.count({ where: { parsingStatus: { in: ['PENDING', 'PROCESSING', 'PARTIAL', 'FAILED'] } } }),
    prisma.offer.count({ where: { organisationId: context.organisationId, expiryAt: { gte: now }, status: { in: ['RELEASED', 'VIEWED'] } } }),
    prisma.interviewRound.count({ where: { organisationId: context.organisationId, status: 'SCHEDULED', scheduledStartAt: { gte: now, lte: soon } } }),
    prisma.notification.count({ where: { organisationId: context.organisationId, readAt: null } }),
    prisma.backgroundTask.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        OR: [
          { organisationId: context.organisationId },
          { organisationId: null },
        ],
      },
    }).catch(() => []),
  ]);

  const statusCounts = Object.fromEntries(taskSummary.map((row) => [row.status, row._count._all]));

  return {
    resumeParsing: {
      active: resumeParsing,
      note: `Counts persisted resume assets with unresolved parsing status. Pending worker tasks: ${statusCounts.PENDING || 0}.`,
    },
    offerExpiry: {
      active: offerExpiry,
      note: `Background expiry processing is enabled. Retry-scheduled tasks: ${statusCounts.RETRY_SCHEDULED || 0}.`,
    },
    interviewReminders: {
      activeWindow: interviewReminders,
      note: `Reminder windows are scheduled through background tasks. Running tasks: ${statusCounts.RUNNING || 0}.`,
    },
    emailQueue: {
      visibleBacklogProxy: emailBacklog,
      note: `Unread notifications proxy product attention. Email retry tasks: ${statusCounts.FAILED || 0} failed, ${statusCounts.DEAD_LETTER || 0} dead-letter.`,
    },
    failedJobs: {
      active: (statusCounts.FAILED || 0) + (statusCounts.DEAD_LETTER || 0),
      note: 'Counts failed and dead-letter background tasks.',
    },
    futureWorkers: ['notification retries', 'intelligence execution offloading', 'data export batching', 'stale-result cleanup'],
  };
}

export async function getEnterpriseAnalytics(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.analytics.read', organisationId);
  const analytics = await getOrganisationAnalyticsMetrics(context.organisationId, {});
  return {
    metrics: {
      activeJobs: analytics.metrics.activeJobs,
      draftJobs: analytics.metrics.draftJobs,
      applications: analytics.sampleSize.applications,
      interviews: analytics.sampleSize.interviews,
      offers: analytics.sampleSize.offers,
      joining: analytics.metrics.hiringVelocity,
      timeToHireDays: analytics.metrics.timeToHireDaysMedian,
      offerAcceptanceRate: analytics.metrics.offerAcceptanceRate,
      recruiterPerformanceCount: analytics.sampleSize.recruiters,
      hiringVelocity: analytics.metrics.hiringVelocity,
      applicationToInterviewConversion: analytics.metrics.applicationToInterviewConversion,
      interviewToOfferConversion: analytics.metrics.interviewToOfferConversion,
    },
    pipelineFunnel: analytics.funnel.map((row) => ({
      stage: row.stage,
      count: row.count,
    })),
    sourceEffectiveness: analytics.sourceEffectiveness,
    recruiterBreakdown: analytics.recruiterBreakdown,
    aging: analytics.aging,
    period: analytics.period,
    version: analytics.version,
  };
}

export async function listFeatureFlagsAdmin(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.flags.manage', organisationId);
  const flags = await prisma.featureFlag.findMany({
    where: { organisationId: context.organisationId },
    orderBy: { key: 'asc' },
  });
  return flags.map(serializeFeatureFlag);
}

export async function createOrUpdateFeatureFlagAdmin(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.flags.manage', organisationId);
  const existing = payload.id
    ? await prisma.featureFlag.findFirst({ where: { id: payload.id, organisationId: context.organisationId } })
    : await prisma.featureFlag.findUnique({ where: { organisationId_key: { organisationId: context.organisationId, key: payload.key } } }).catch(() => null);

  const flag = existing
    ? await prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          key: payload.key,
          description: asNullOrTrimmed(payload.description),
          enabled: payload.enabled,
          updatedByUserId: actorUser.id,
        },
      })
    : await prisma.featureFlag.create({
        data: {
          organisationId: context.organisationId,
          key: payload.key,
          description: asNullOrTrimmed(payload.description),
          enabled: payload.enabled,
          updatedByUserId: actorUser.id,
        },
      });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: existing ? 'admin.feature-flag.update' : 'admin.feature-flag.create',
    entityType: 'FeatureFlag',
    entityId: flag.id,
    beforeData: existing,
    afterData: flag,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return serializeFeatureFlag(flag);
}

export async function getLookupAdministration(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.lookups.manage', organisationId);
  const settings = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  return settings.lookupSettings || {};
}

export async function updateLookupAdministration(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'organisation.lookups.manage', organisationId);
  const existing = await ensureOrganisationSettings(context.organisationId, actorUser.id);
  const updatedLookupSettings = {
    ...(existing.lookupSettings || {}),
    ...payload,
  };

  const updated = await prisma.organisationSettings.update({
    where: { organisationId: context.organisationId },
    data: {
      lookupSettings: updatedLookupSettings,
      updatedByUserId: actorUser.id,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'admin.lookup-settings.update',
    entityType: 'OrganisationSettings',
    entityId: updated.id,
    beforeData: existing.lookupSettings,
    afterData: updatedLookupSettings,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return updated.lookupSettings || {};
}
