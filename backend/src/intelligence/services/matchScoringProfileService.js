import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import {
  getDefaultMatchScoringProfileVersionInput,
  normalizeMatchScoringProfileVersionInput,
} from './candidateMatchScoringService.js';

const FEATURE = 'MATCH_SCORING_PROFILE';

function buildDefaultVersionStub(organisationId, actorUserId = null) {
  const defaults = getDefaultMatchScoringProfileVersionInput();
  const payload = normalizeMatchScoringProfileVersionInput(defaults);
  return {
    id: `default-profile-version:${organisationId}`,
    organisationId,
    profileId: `default-profile:${organisationId}`,
    version: 1,
    status: 'ACTIVE',
    title: defaults.versionTitle,
    ...payload,
    createdByUserId: actorUserId,
    createdAt: new Date(),
  };
}

function serializeVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    organisationId: version.organisationId,
    profileId: version.profileId,
    version: version.version,
    status: version.status,
    title: version.title || null,
    weightsJson: version.weightsJson,
    knockoutRulesJson: version.knockoutRulesJson,
    thresholdsJson: version.thresholdsJson,
    confidenceRulesJson: version.confidenceRulesJson,
    normalizationVersion: version.normalizationVersion,
    schemaVersion: version.schemaVersion,
    promptKey: version.promptKey || null,
    promptVersion: version.promptVersion || null,
    resultVersion: version.resultVersion,
    createdByUserId: version.createdByUserId || null,
    createdAt: version.createdAt.toISOString(),
  };
}

function serializeProfile(profile, versions = null) {
  if (!profile) return null;
  return {
    id: profile.id,
    organisationId: profile.organisationId,
    key: profile.key,
    name: profile.name,
    description: profile.description || null,
    isActive: Boolean(profile.isActive),
    activeVersionId: profile.activeVersionId || null,
    activatedAt: profile.activatedAt ? profile.activatedAt.toISOString() : null,
    activatedByUserId: profile.activatedByUserId || null,
    archivedAt: profile.archivedAt ? profile.archivedAt.toISOString() : null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    versions: versions ? versions.map(serializeVersion) : undefined,
  };
}

async function ensureOrganisationScopedProfile(actorUser, profileId, mode = 'read') {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, mode);
  const profile = await prisma.matchScoringProfile.findFirst({
    where: {
      id: profileId,
      organisationId: permissionContext.organisationId,
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });
  if (!profile) {
    const error = new Error('Match scoring profile not found.');
    error.statusCode = 404;
    throw error;
  }
  return { permissionContext, profile };
}

export async function ensureDefaultMatchScoringProfile(organisationId, actorUserId = null) {
  if (!prisma.matchScoringProfile?.findFirst || !prisma.matchScoringProfileVersion?.create) {
    return buildDefaultVersionStub(organisationId, actorUserId);
  }
  let profile;
  try {
    profile = await prisma.matchScoringProfile.findFirst({
      where: {
        organisationId,
        key: 'default',
      },
      include: {
        activeVersion: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
  } catch (error) {
    if (error?.code === 'P2021') {
      return buildDefaultVersionStub(organisationId, actorUserId);
    }
    throw error;
  }

  if (profile?.activeVersion) {
    return profile.activeVersion;
  }

  const defaults = getDefaultMatchScoringProfileVersionInput();

  if (!profile) {
    profile = await prisma.matchScoringProfile.create({
      data: {
        organisationId,
        key: defaults.key,
        name: defaults.name,
        description: defaults.description,
        isActive: true,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
  }

  const versionPayload = normalizeMatchScoringProfileVersionInput(defaults);
  const latestVersion = await prisma.matchScoringProfileVersion.findFirst({
    where: {
      profileId: profile.id,
    },
    orderBy: { version: 'desc' },
  });
  const versionNumber = (latestVersion?.version || 0) + 1;

  const version = await prisma.matchScoringProfileVersion.create({
    data: {
      organisationId,
      profileId: profile.id,
      version: versionNumber,
      status: 'ACTIVE',
      title: defaults.versionTitle,
      ...versionPayload,
      createdByUserId: actorUserId,
    },
  });

  await prisma.matchScoringProfile.update({
    where: { id: profile.id },
    data: {
      activeVersionId: version.id,
      activatedAt: new Date(),
      activatedByUserId: actorUserId,
      updatedByUserId: actorUserId,
    },
  });

  return version;
}

export async function resolveActiveMatchScoringProfileVersion(organisationId, preferredProfileVersionId = null, preferredProfileId = null, actorUserId = null) {
  if (!prisma.matchScoringProfile?.findFirst || !prisma.matchScoringProfileVersion?.findFirst) {
    return buildDefaultVersionStub(organisationId, actorUserId);
  }
  try {
    if (preferredProfileVersionId) {
      const version = await prisma.matchScoringProfileVersion.findFirst({
        where: {
          id: preferredProfileVersionId,
          organisationId,
        },
      });
      if (!version) {
        const error = new Error('Match scoring profile version not found.');
        error.statusCode = 404;
        throw error;
      }
      return version;
    }

    if (preferredProfileId) {
      const profile = await prisma.matchScoringProfile.findFirst({
        where: {
          id: preferredProfileId,
          organisationId,
        },
        include: {
          activeVersion: true,
        },
      });
      if (!profile) {
        const error = new Error('Match scoring profile not found.');
        error.statusCode = 404;
        throw error;
      }
      if (profile.activeVersion) return profile.activeVersion;
    }

    const activeProfile = await prisma.matchScoringProfile.findFirst({
      where: {
        organisationId,
        isActive: true,
        archivedAt: null,
        activeVersionId: { not: null },
      },
      include: {
        activeVersion: true,
      },
      orderBy: [{ activatedAt: 'desc' }, { createdAt: 'asc' }],
    });

    if (activeProfile?.activeVersion) {
      return activeProfile.activeVersion;
    }

    return ensureDefaultMatchScoringProfile(organisationId, actorUserId);
  } catch (error) {
    if (error?.code === 'P2021') {
      return buildDefaultVersionStub(organisationId, actorUserId);
    }
    throw error;
  }
}

export async function listMatchScoringProfiles(actorUser) {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, 'read');
  const profiles = await prisma.matchScoringProfile.findMany({
    where: {
      organisationId: permissionContext.organisationId,
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
    orderBy: [{ isActive: 'desc' }, { key: 'asc' }],
  });
  return profiles.map((profile) => serializeProfile(profile, profile.versions));
}

export async function createMatchScoringProfile(actorUser, payload, requestMeta = {}) {
  const permissionContext = await requireIntelligenceFeature(actorUser, FEATURE, null, 'generate');
  const profile = await prisma.matchScoringProfile.create({
    data: {
      organisationId: permissionContext.organisationId,
      key: payload.key,
      name: payload.name,
      description: payload.description || null,
      isActive: payload.isActive !== false,
      createdByUserId: actorUser.id,
      updatedByUserId: actorUser.id,
    },
  });

  const versionPayload = normalizeMatchScoringProfileVersionInput(payload);
  const version = await prisma.matchScoringProfileVersion.create({
    data: {
      organisationId: permissionContext.organisationId,
      profileId: profile.id,
      version: 1,
      status: payload.isActive === false ? 'DRAFT' : 'ACTIVE',
      title: payload.title || null,
      ...versionPayload,
      createdByUserId: actorUser.id,
    },
  });

  const updated = await prisma.matchScoringProfile.update({
    where: { id: profile.id },
    data: {
      activeVersionId: payload.isActive === false ? null : version.id,
      activatedAt: payload.isActive === false ? null : new Date(),
      activatedByUserId: payload.isActive === false ? null : actorUser.id,
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match-scoring-profile.create',
    entityType: 'MatchScoringProfile',
    entityId: profile.id,
    metadata: { versionId: version.id, version: 1 },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return serializeProfile(updated, updated.versions);
}

export async function getMatchScoringProfile(actorUser, payload) {
  const { profile } = await ensureOrganisationScopedProfile(actorUser, payload.profileId, 'read');
  return serializeProfile(profile, profile.versions);
}

export async function createMatchScoringProfileVersion(actorUser, payload, requestMeta = {}) {
  const { permissionContext, profile } = await ensureOrganisationScopedProfile(actorUser, payload.profileId, 'generate');
  const latestVersion = profile.versions[0];
  const versionPayload = normalizeMatchScoringProfileVersionInput(payload);

  const version = await prisma.matchScoringProfileVersion.create({
    data: {
      organisationId: permissionContext.organisationId,
      profileId: profile.id,
      version: (latestVersion?.version || 0) + 1,
      status: payload.activate ? 'ACTIVE' : 'DRAFT',
      title: payload.title || null,
      ...versionPayload,
      createdByUserId: actorUser.id,
    },
  });

  if (payload.activate) {
    await prisma.matchScoringProfile.update({
      where: { id: profile.id },
      data: {
        activeVersionId: version.id,
        activatedAt: new Date(),
        activatedByUserId: actorUser.id,
        updatedByUserId: actorUser.id,
      },
    });
  }

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match-scoring-profile.version.create',
    entityType: 'MatchScoringProfileVersion',
    entityId: version.id,
    metadata: { profileId: profile.id, version: version.version, activate: Boolean(payload.activate) },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return serializeVersion(version);
}

export async function activateMatchScoringProfile(actorUser, payload, requestMeta = {}) {
  const { permissionContext, profile } = await ensureOrganisationScopedProfile(actorUser, payload.profileId, 'generate');
  const targetVersion = payload.versionId
    ? profile.versions.find((item) => item.id === payload.versionId)
    : profile.versions[0];

  if (!targetVersion) {
    const error = new Error('Match scoring profile version not found.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.matchScoringProfile.update({
    where: { id: profile.id },
    data: {
      isActive: payload.active !== false,
      activeVersionId: payload.active === false ? null : targetVersion.id,
      activatedAt: payload.active === false ? null : new Date(),
      activatedByUserId: payload.active === false ? null : actorUser.id,
      updatedByUserId: actorUser.id,
    },
  });

  if (payload.active !== false) {
    await prisma.matchScoringProfileVersion.update({
      where: { id: targetVersion.id },
      data: { status: 'ACTIVE' },
    });
  }

  await recordAuditLog({
    organisationId: permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.match-scoring-profile.activate',
    entityType: 'MatchScoringProfile',
    entityId: profile.id,
    metadata: { versionId: targetVersion.id, active: payload.active !== false },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  const updated = await prisma.matchScoringProfile.findUnique({
    where: { id: profile.id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });
  return serializeProfile(updated, updated.versions);
}
