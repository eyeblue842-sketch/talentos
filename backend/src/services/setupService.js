import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { ensureOrganisationSettings, ensureSystemRoleDefinitions } from './adminService.js';

const SETUP_STATE_ID = 'platform-setup';
const SETUP_VERSION = '9.0.0';
const INTELLIGENCE_FEATURE_FLAGS = [
  'intelligence.resume_summary',
  'intelligence.skill_extraction',
  'intelligence.candidate_matching',
  'intelligence.candidate_intelligence',
  'intelligence.job_description',
  'intelligence.interview_assistant',
  'intelligence.talent_search',
  'intelligence.analytics_insights',
];

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function buildUniqueOrganisationSlug(name, tx = prisma) {
  const base = slugify(name, { lower: true, strict: true }) || `org-${Date.now()}`;
  let slug = base;
  let counter = 1;
  while (await tx.organisation.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

function buildDefaultSchedulingSettings(preferences, organisation) {
  return {
    defaultMeetingProvider: preferences.defaultMeetingProvider,
    allowedProviders: [
      'CUSTOM',
      ...(preferences.googleEnabled ? ['GOOGLE_MEET'] : []),
      ...(preferences.zoomEnabled ? ['ZOOM'] : []),
    ],
    defaultInterviewDuration: 60,
    minimumSchedulingNoticeMinutes: 60,
    maximumCandidateRequests: 3,
    maximumRescheduleCount: 10,
    reminderIntervalsMinutes: [1440, 60, 15],
    includeRecruiterInInvite: true,
    includeCoordinatorInInvite: true,
    allowAvailabilityChecks: preferences.googleEnabled || preferences.zoomEnabled,
    allowManualCustomLink: true,
    candidateRescheduleEnabled: true,
    interviewerRescheduleEnabled: true,
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    workingHours: { start: '09:00', end: '18:00', timezone: organisation.timezone },
    zoomWaitingRoomDefault: preferences.zoomEnabled,
    cancellationReasonRequired: true,
  };
}

async function getSetupState() {
  if (!prisma.platformSetupState?.findUnique) {
    return null;
  }

  try {
    return await prisma.platformSetupState.findUnique({ where: { id: SETUP_STATE_ID } });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return null;
    }
    throw error;
  }
}

async function countInitializationSignals() {
  const [organisationCount, adminCount] = await Promise.all([
    prisma.organisation.count(),
    prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        accountStatus: 'ACTIVE',
      },
    }),
  ]);

  return {
    organisationCount,
    adminCount,
    hasOrganisation: organisationCount > 0,
    hasSuperAdmin: adminCount > 0,
  };
}

export async function getInitialSetupStatus() {
  let state = null;
  let signals = null;

  try {
    [state, signals] = await Promise.all([getSetupState(), countInitializationSignals()]);
  } catch (error) {
    const setupStateUnavailable = error?.code === 'P2021'
      || error?.code === 'P2022'
      || error?.message?.includes("reading 'findUnique'")
      || error?.message?.includes('platformSetupState');

    if (!setupStateUnavailable) {
      throw error;
    }

    return {
      initialized: true,
      setupCompleted: true,
      setupVersion: null,
      setupCompletedAt: null,
      hasOrganisation: false,
      hasSuperAdmin: false,
      organisationCount: 0,
      superAdminCount: 0,
      forcedSetupMode: false,
    };
  }

  const initialized = state
    ? state.setupCompleted
    : (signals.hasOrganisation && signals.hasSuperAdmin);

  return {
    initialized,
    setupCompleted: Boolean(state?.setupCompleted),
    setupVersion: state?.setupVersion || null,
    setupCompletedAt: state?.setupCompletedAt?.toISOString() || null,
    hasOrganisation: signals.hasOrganisation,
    hasSuperAdmin: signals.hasSuperAdmin,
    organisationCount: signals.organisationCount,
    superAdminCount: signals.adminCount,
    forcedSetupMode: Boolean(state && !state.setupCompleted),
  };
}

export async function assertInitialSetupCompleted() {
  const status = await getInitialSetupStatus();
  if (!status.initialized) {
    throw createError('Initial setup is not complete.', 503);
  }
  return status;
}

export async function completeInitialSetup(payload, requestMeta = {}) {
  const status = await getInitialSetupStatus();
  if (status.initialized) {
    throw createError('Initial setup has already been completed.', 409);
  }

  const normalizedEmail = payload.superAdmin.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw createError('A user with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(payload.superAdmin.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const slug = await buildUniqueOrganisationSlug(payload.organisation.companyName, tx);

    const organisation = await tx.organisation.create({
      data: {
        name: payload.organisation.companyName,
        slug,
        logoUrl: payload.organisation.companyLogoUrl || null,
        industry: payload.organisation.industry,
        headquarters: payload.organisation.country,
        publicLocations: [payload.organisation.country],
        organisationSize: null,
        status: 'ACTIVE',
        onboardingCompletedAt: new Date(),
        careersEnabled: true,
      },
    });

    const adminUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: payload.superAdmin.name.trim(),
        phoneNumber: payload.superAdmin.mobile.trim(),
        role: 'ADMIN',
        isActive: true,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    await tx.organisationMembership.create({
      data: {
        organisationId: organisation.id,
        userId: adminUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    await ensureSystemRoleDefinitions(organisation.id, tx);
    const settings = await ensureOrganisationSettings(organisation.id, adminUser.id, tx);

    const updatedSettings = await tx.organisationSettings.update({
      where: { id: settings.id },
      data: {
        timezone: payload.organisation.timezone,
        currency: payload.organisation.currency,
        language: payload.preferences.language,
        dateFormat: payload.organisation.dateFormat,
        interviewSchedulingSettings: buildDefaultSchedulingSettings(payload.preferences, payload.organisation),
        notificationDefaults: {
          emailProvider: payload.preferences.emailProvider,
          channels: payload.preferences.notificationPreferences,
        },
        emailBranding: {
          provider: payload.preferences.emailProvider,
          organisationName: payload.organisation.companyName,
          logoUrl: payload.organisation.companyLogoUrl || null,
        },
        updatedByUserId: adminUser.id,
      },
    });

    if (payload.preferences.aiEnabled) {
      await tx.featureFlag.createMany({
        data: INTELLIGENCE_FEATURE_FLAGS.map((key) => ({
          organisationId: organisation.id,
          key,
          enabled: true,
          description: 'Enabled during initial setup.',
          updatedByUserId: adminUser.id,
        })),
        skipDuplicates: true,
      });
    }

    const state = await tx.platformSetupState.upsert({
      where: { id: SETUP_STATE_ID },
      update: {
        setupCompleted: true,
        setupVersion: SETUP_VERSION,
        setupCompletedAt: new Date(),
        setupCompletedBy: adminUser.id,
      },
      create: {
        id: SETUP_STATE_ID,
        setupCompleted: true,
        setupVersion: SETUP_VERSION,
        setupCompletedAt: new Date(),
        setupCompletedBy: adminUser.id,
      },
    });

    return {
      organisation,
      adminUser,
      settings: updatedSettings,
      state,
    };
  });

  await recordAuditLog({
    organisationId: result.organisation.id,
    actorUserId: result.adminUser.id,
    action: 'platform.initial-setup.complete',
    entityType: 'PlatformSetupState',
    entityId: result.state.id,
    afterData: {
      organisationId: result.organisation.id,
      adminUserId: result.adminUser.id,
      setupVersion: result.state.setupVersion,
    },
    metadata: {
      language: payload.preferences.language,
      defaultMeetingProvider: payload.preferences.defaultMeetingProvider,
      googleEnabled: payload.preferences.googleEnabled,
      zoomEnabled: payload.preferences.zoomEnabled,
      aiEnabled: payload.preferences.aiEnabled,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return {
    initialized: true,
    setupVersion: result.state.setupVersion,
    organisationId: result.organisation.id,
    superAdminUserId: result.adminUser.id,
  };
}

async function assertResetIsSafe(tx, actorUserId) {
  const [organisationCount, adminCount, userCount, jobs, applications, interviews, offers] = await Promise.all([
    tx.organisation.count(),
    tx.user.count({ where: { role: 'ADMIN' } }),
    tx.user.count(),
    tx.job.count(),
    tx.application.count(),
    tx.interviewRound.count(),
    tx.offer.count(),
  ]);

  const hasOperationalData = jobs > 0 || applications > 0 || interviews > 0 || offers > 0;
  const unexpectedUsers = userCount > 1 || adminCount > 1;
  const unexpectedOrgs = organisationCount > 1;

  if (hasOperationalData || unexpectedUsers || unexpectedOrgs) {
    throw createError('Initial setup can only be reset before the system contains operational data.', 409);
  }

  const actor = await tx.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== 'ADMIN') {
    throw createError('Only a super administrator can reset initial setup.', 403);
  }

  return actor;
}

export async function resetInitialSetup(actorUser, password, requestMeta = {}) {
  if (actorUser.role !== 'ADMIN') {
    throw createError('Only a super administrator can reset initial setup.', 403);
  }

  const passwordMatches = await bcrypt.compare(password, actorUser.passwordHash);
  if (!passwordMatches) {
    throw createError('Password confirmation failed.', 403);
  }

  await prisma.$transaction(async (tx) => {
    const actor = await assertResetIsSafe(tx, actorUser.id);
    const membership = await tx.organisationMembership.findFirst({
      where: { userId: actor.id },
      select: { organisationId: true },
    });

    await tx.auditLog.create({
      data: {
        organisationId: membership?.organisationId || null,
        actorUserId: actor.id,
        action: 'platform.initial-setup.reset',
        entityType: 'PlatformSetupState',
        entityId: SETUP_STATE_ID,
        metadata: {
          resetRequested: true,
        },
        ipAddress: requestMeta.ipAddress || null,
        userAgent: requestMeta.userAgent || null,
      },
    });

    await tx.platformSetupState.upsert({
      where: { id: SETUP_STATE_ID },
      update: {
        setupCompleted: false,
        setupVersion: null,
        setupCompletedAt: null,
        setupCompletedBy: null,
        lastResetAt: new Date(),
        lastResetBy: actor.id,
      },
      create: {
        id: SETUP_STATE_ID,
        setupCompleted: false,
        lastResetAt: new Date(),
        lastResetBy: actor.id,
      },
    });

    if (membership?.organisationId) {
      await tx.organisation.delete({ where: { id: membership.organisationId } });
    }

    await tx.user.delete({ where: { id: actor.id } });
  });

  return { reset: true };
}
