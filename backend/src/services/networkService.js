import { prisma } from '../config/db.js';
import { createNotification } from './notificationService.js';
import { serializeOrganisation } from '../serializers/index.js';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const SEARCH_CANDIDATE_WINDOW = 120;
const SUGGESTION_CANDIDATE_WINDOW = 160;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function titleCaseFromEmail(email) {
  const localPart = String(email || '').split('@')[0];
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Careeriz Professional';
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function clampPage(total, requestedPage, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, requestedPage), pageCount);
}

function paginateRows(rows, page, pageSize) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

function asObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function extractPreviousCompanies(profile) {
  return uniq(
    asObjectArray(profile?.experienceEntries)
      .map((entry) => entry.company || entry.companyName || entry.employer || null)
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
}

function extractEducationTokens(profile) {
  return uniq(
    asObjectArray(profile?.educationEntries)
      .flatMap((entry) => [
        entry.degree,
        entry.specialization,
        entry.fieldOfStudy,
        entry.institution,
        entry.school,
      ])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
}

function buildPairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(':');
}

function getConnectionDate(connection) {
  return connection.acceptedAt || connection.updatedAt || connection.createdAt;
}

function buildMessageCapability(connectionStatus) {
  return {
    enabled: connectionStatus === 'ACCEPTED',
    allowed: connectionStatus === 'ACCEPTED',
    reason: connectionStatus === 'ACCEPTED'
      ? null
      : 'An accepted Careeriz connection is required before messaging.',
  };
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getProfileName(user) {
  return user.candidateProfile?.fullName || user.name || titleCaseFromEmail(user.email);
}

function getProfessionalSummary(user) {
  if (user.role === 'CANDIDATE' || user.role === 'CANDIDATE_ADMIN') {
    const profile = user.candidateProfile;
    return {
      headline: profile?.headline || profile?.currentTitle || profile?.currentDesignation || null,
      designation: profile?.currentDesignation || profile?.currentTitle || null,
      company: profile?.currentEmployer || null,
      location: profile?.location || null,
      profilePhoto: profile?.profileImageUrl || null,
      domainSummary: uniq([
        ...(profile?.skills || []).slice(0, 3),
        ...(profile?.functionalSkills || []).slice(0, 2),
        ...(profile?.frameworks || []).slice(0, 2),
      ]).slice(0, 5),
      skills: uniq([...(profile?.skills || []), ...(profile?.functionalSkills || [])]).slice(0, 12),
      educationSummary: extractEducationTokens(profile).slice(0, 3),
      experienceYears: profile?.totalExperience ?? null,
      industry: (profile?.preferredIndustries || [])[0] || null,
      currentCompanyHistory: extractPreviousCompanies(profile),
    };
  }

  const recruiter = user.recruiterProfile;
  const organisation = recruiter?.organisation;
  return {
    headline: recruiter?.designation || recruiter?.industryDomain || null,
    designation: recruiter?.designation || null,
    company: recruiter?.companyName || organisation?.name || null,
    location: recruiter?.headquartersLocation || organisation?.headquarters || null,
    profilePhoto: null,
    domainSummary: uniq([
      recruiter?.industryDomain,
      recruiter?.companyType,
      organisation?.industry,
    ]).slice(0, 4),
    skills: [],
    educationSummary: [],
    experienceYears: recruiter?.workingSince ? Math.max(0, new Date().getFullYear() - recruiter.workingSince) : null,
    industry: recruiter?.industryDomain || organisation?.industry || null,
    currentCompanyHistory: [],
  };
}

function getEffectivePrivacy(user) {
  const settings = user.networkPrivacySettings || {};
  const candidateProfile = user.candidateProfile;
  return {
    allowConnectionRequestsFrom: settings.allowConnectionRequestsFrom || 'EVERYONE',
    connectionVisibility: settings.connectionVisibility || 'CONNECTIONS_ONLY',
    showInPeopleSearch: settings.showInPeopleSearch ?? (
      user.role === 'RECRUITER' || user.role === 'RECRUITER_ADMIN'
        ? true
        : Boolean(candidateProfile?.searchableProfile && candidateProfile?.profileVisibility !== 'PRIVATE')
    ),
    showRecruiterIdentity: settings.showRecruiterIdentity ?? true,
  };
}

function canSearchTarget(actor, target) {
  if (actor.id === target.id) return true;
  const privacy = getEffectivePrivacy(target);
  if (!privacy.showInPeopleSearch) return false;
  if ((target.role === 'RECRUITER' || target.role === 'RECRUITER_ADMIN') && !privacy.showRecruiterIdentity) {
    return false;
  }
  if (target.role === 'CANDIDATE' || target.role === 'CANDIDATE_ADMIN') {
    const visibility = target.candidateProfile?.profileVisibility || 'PRIVATE';
    if (visibility === 'PUBLIC') return true;
    if (visibility === 'RECRUITERS_ONLY') {
      return actor.role === 'RECRUITER' || actor.role === 'RECRUITER_ADMIN';
    }
    return false;
  }
  return true;
}

function canSendConnectionRequest(actor, target) {
  if (!target) return false;
  if (actor.id === target.id) return false;
  const privacy = getEffectivePrivacy(target);
  if (privacy.allowConnectionRequestsFrom === 'NOBODY') return false;
  if (privacy.allowConnectionRequestsFrom === 'RECRUITERS_ONLY') {
    return actor.role === 'RECRUITER' || actor.role === 'RECRUITER_ADMIN';
  }
  return true;
}

function canViewConnections(actorUserId, target, connectionStatus) {
  if (actorUserId === target.id) return true;
  const privacy = getEffectivePrivacy(target);
  if (privacy.connectionVisibility === 'EVERYONE') return true;
  if (privacy.connectionVisibility === 'CONNECTIONS_ONLY') return connectionStatus === 'ACCEPTED';
  return false;
}

function canViewMutualConnections(actor, target, connectionStatus) {
  if (actor.id === target.id) return true;
  if (canViewConnections(actor.id, target, connectionStatus)) return true;
  return canSearchTarget(actor, target);
}

function createHttpError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

async function findUserOrThrow(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      candidateProfile: true,
      recruiterProfile: {
        include: { organisation: true },
      },
      networkPrivacySettings: true,
    },
  });

  if (!user || !user.isActive) {
    throw createHttpError('User not found.', 404);
  }

  return user;
}

async function getBlockedRelationship(actorUserId, targetUserId) {
  return prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: actorUserId, blockedUserId: targetUserId },
        { blockerUserId: targetUserId, blockedUserId: actorUserId },
      ],
    },
  });
}

async function getConnectionBetween(userIdA, userIdB) {
  return prisma.userConnection.findUnique({
    where: { pairKey: buildPairKey(userIdA, userIdB) },
  });
}

async function getAcceptedConnectionIds(userId) {
  const rows = await prisma.userConnection.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterUserId: userId },
        { receiverUserId: userId },
      ],
    },
    select: {
      requesterUserId: true,
      receiverUserId: true,
    },
  });

  return new Set(rows.map((row) => (row.requesterUserId === userId ? row.receiverUserId : row.requesterUserId)));
}

async function getMutualConnectionIds(userIdA, userIdB) {
  const [left, right] = await Promise.all([
    getAcceptedConnectionIds(userIdA),
    getAcceptedConnectionIds(userIdB),
  ]);

  return [...left].filter((userId) => right.has(userId));
}

async function getConnectionStatusDetails(actorUserId, targetUserId) {
  const [block, connection] = await Promise.all([
    getBlockedRelationship(actorUserId, targetUserId),
    getConnectionBetween(actorUserId, targetUserId),
  ]);

  if (block) {
    return {
      status: 'BLOCKED',
      blockedByActor: block.blockerUserId === actorUserId,
      connection,
      connectedAt: connection?.acceptedAt || null,
    };
  }

  if (!connection) {
    return {
      status: 'NONE',
      blockedByActor: false,
      connection: null,
      connectedAt: null,
    };
  }

  return {
    status: connection.status,
    blockedByActor: false,
    connection,
    connectedAt: connection.acceptedAt || null,
  };
}

async function serializeProfessionalCard(actor, target, options = {}) {
  const summary = getProfessionalSummary(target);
  const status = options.connectionStatus || await getConnectionStatusDetails(actor.id, target.id);
  const mutualConnectionIds = options.mutualConnectionIds || await getMutualConnectionIds(actor.id, target.id);

  return {
    userId: target.id,
    role: target.role,
    fullName: getProfileName(target),
    headline: summary.headline,
    designation: summary.designation,
    company: summary.company,
    location: summary.location,
    profilePhoto: summary.profilePhoto,
    skills: summary.skills.slice(0, 6),
    domainSummary: summary.domainSummary,
    experienceYears: summary.experienceYears,
    educationSummary: summary.educationSummary,
    organisation: target.recruiterProfile?.organisation ? serializeOrganisation(target.recruiterProfile.organisation) : null,
    connectionStatus: status.status,
    connectionId: status.connection?.status === 'ACCEPTED' ? status.connection.id : null,
    requestId: status.connection?.status === 'PENDING' ? status.connection.id : null,
    pendingDirection: status.connection?.status === 'PENDING'
      ? (status.connection.requesterUserId === actor.id ? 'OUTGOING' : 'INCOMING')
      : null,
    connectedAt: toIso(status.connectedAt),
    mutualConnections: {
      count: mutualConnectionIds.length,
      userIds: mutualConnectionIds.slice(0, 8),
    },
    canConnect: status.status === 'NONE' && canSendConnectionRequest(actor, target),
    canMessage: buildMessageCapability(status.status),
    isSelf: actor.id === target.id,
  };
}

function matchCandidateAgainstFilters(candidate, filters = {}) {
  const profile = candidate.candidateProfile;
  if (!profile) return false;

  const searchableText = [
    candidate.name,
    candidate.email,
    profile.fullName,
    profile.headline,
    profile.currentTitle,
    profile.currentDesignation,
    profile.currentEmployer,
    profile.location,
    ...(profile.skills || []),
    ...extractPreviousCompanies(profile),
    ...extractEducationTokens(profile),
  ].map(normalize);

  const textNeedles = [filters.q, filters.name, filters.designation, filters.domain, filters.industry, filters.currentCompany, filters.previousCompany, filters.location, filters.education]
    .filter(Boolean)
    .map(normalize);

  if (textNeedles.some((needle) => !searchableText.some((hay) => hay.includes(needle)))) {
    return false;
  }

  if (filters.skills?.length) {
    const skillSet = new Set((profile.skills || []).map(normalize));
    if (!filters.skills.some((skill) => skillSet.has(normalize(skill)))) {
      return false;
    }
  }

  if (typeof filters.minExperience === 'number' && (profile.totalExperience || 0) < filters.minExperience) return false;
  if (typeof filters.maxExperience === 'number' && (profile.totalExperience || 0) > filters.maxExperience) return false;

  return true;
}

function matchRecruiterAgainstFilters(recruiter, filters = {}) {
  const profile = recruiter.recruiterProfile;
  if (!profile) return false;

  const searchableText = [
    recruiter.name,
    recruiter.email,
    profile.designation,
    profile.companyName,
    profile.industryDomain,
    profile.headquartersLocation,
    profile.companyType,
    profile.organisation?.name,
    profile.organisation?.industry,
    profile.organisation?.headquarters,
  ].map(normalize);

  const textNeedles = [filters.q, filters.name, filters.designation, filters.domain, filters.industry, filters.currentCompany, filters.location]
    .filter(Boolean)
    .map(normalize);

  return textNeedles.every((needle) => searchableText.some((hay) => hay.includes(needle)));
}

function scoreSearchCandidate(user, filters = {}) {
  const summary = getProfessionalSummary(user);
  let score = 0;
  const reasons = [];
  const text = normalize(filters.q);
  const nameNeedle = normalize(filters.name);
  const designationNeedle = normalize(filters.designation);
  const locationNeedle = normalize(filters.location);
  const userName = normalize(getProfileName(user));
  const headline = normalize(summary.headline);
  const location = normalize(summary.location);

  if (text && (userName.includes(text) || headline.includes(text))) score += 40;
  if (nameNeedle && userName.includes(nameNeedle)) score += 30;
  if (designationNeedle && headline.includes(designationNeedle)) score += 20;
  if (locationNeedle && location.includes(locationNeedle)) score += 14;
  if (filters.skills?.length) {
    const skills = new Set(summary.skills.map(normalize));
    const overlap = filters.skills.filter((skill) => skills.has(normalize(skill))).length;
    score += overlap * 12;
    if (overlap) reasons.push(`Shared skills: ${overlap}`);
  }

  return { score, reasons };
}

function scoreSuggestion(actor, target, mutualConnectionCount) {
  const actorSummary = getProfessionalSummary(actor);
  const targetSummary = getProfessionalSummary(target);
  const actorSkills = new Set(actorSummary.skills.map(normalize));
  const targetSkills = new Set(targetSummary.skills.map(normalize));
  const sharedSkills = [...actorSkills].filter((skill) => targetSkills.has(skill));
  const actorTitle = normalize(actorSummary.designation || actorSummary.headline);
  const targetTitle = normalize(targetSummary.designation || targetSummary.headline);
  const actorLocation = normalize(actorSummary.location);
  const targetLocation = normalize(targetSummary.location);
  const actorCompany = normalize(actorSummary.company);
  const targetCompany = normalize(targetSummary.company);
  const actorIndustry = normalize(actorSummary.industry);
  const targetIndustry = normalize(targetSummary.industry);
  const sharedEducation = actorSummary.educationSummary.filter((value) => targetSummary.educationSummary.map(normalize).includes(normalize(value)));

  let score = 0;
  const reasons = [];

  if (mutualConnectionCount > 0) {
    score += mutualConnectionCount * 18;
    reasons.push(`${mutualConnectionCount} mutual connection${mutualConnectionCount === 1 ? '' : 's'}`);
  }
  if (sharedSkills.length) {
    score += Math.min(4, sharedSkills.length) * 12;
    reasons.push(`Suggested because you both work with ${sharedSkills.slice(0, 2).join(' and ')}`);
  }
  if (actorTitle && targetTitle && (actorTitle.includes(targetTitle) || targetTitle.includes(actorTitle))) {
    score += 18;
    reasons.push('Similar designation');
  }
  if (actorIndustry && targetIndustry && actorIndustry === targetIndustry) {
    score += 10;
    reasons.push(`Both work in ${targetIndustry}`);
  }
  if (actorLocation && targetLocation && actorLocation === targetLocation) {
    score += 9;
    reasons.push(`Based in ${targetSummary.location}`);
  }
  if (actorCompany && targetCompany && actorCompany === targetCompany) {
    score += 8;
    reasons.push(`Connected to the same company context`);
  }
  if (sharedEducation.length) {
    score += 7;
    reasons.push(`Shared education background`);
  }
  if (typeof actorSummary.experienceYears === 'number' && typeof targetSummary.experienceYears === 'number') {
    const delta = Math.abs(actorSummary.experienceYears - targetSummary.experienceYears);
    if (delta <= 2) {
      score += 6;
      reasons.push('Similar experience level');
    }
  }

  return {
    score,
    reason: reasons[0] || 'Professionally relevant to your network',
    explanations: reasons.slice(0, 3),
  };
}

async function loadSearchCandidates(actor, filters = {}) {
  const baseInclude = {
    candidateProfile: true,
    recruiterProfile: {
      include: { organisation: true },
    },
    networkPrivacySettings: true,
  };

  const [candidates, recruiters] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['CANDIDATE', 'CANDIDATE_ADMIN'] },
        candidateProfile: { isNot: null },
      },
      include: baseInclude,
      take: SEARCH_CANDIDATE_WINDOW,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['RECRUITER', 'RECRUITER_ADMIN'] },
        recruiterProfile: { isNot: null },
      },
      include: baseInclude,
      take: SEARCH_CANDIDATE_WINDOW,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return [...candidates, ...recruiters]
    .filter((user) => user.id !== actor.id)
    .filter((user) => canSearchTarget(actor, user))
    .filter((user) => {
      if (filters.role && filters.role !== user.role.replace('_ADMIN', '')) return false;
      return user.candidateProfile ? matchCandidateAgainstFilters(user, filters) : matchRecruiterAgainstFilters(user, filters);
    });
}

export async function getNetworkConnections(actor, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const rows = await prisma.userConnection.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterUserId: actor.id },
        { receiverUserId: actor.id },
      ],
    },
    include: {
      requesterUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
          networkPrivacySettings: true,
        },
      },
      receiverUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
          networkPrivacySettings: true,
        },
      },
    },
    orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const total = rows.length;
  const page = clampPage(total, requestedPage, pageSize);
  const items = await Promise.all(
    paginateRows(rows, page, pageSize).map(async (row) => {
      const target = row.requesterUserId === actor.id ? row.receiverUser : row.requesterUser;
      return {
        connectionId: row.id,
        connectedAt: toIso(getConnectionDate(row)),
        profile: await serializeProfessionalCard(actor, target, {
          connectionStatus: {
            status: 'ACCEPTED',
            blockedByActor: false,
            connection: row,
            connectedAt: row.acceptedAt,
          },
        }),
      };
    }),
  );

  return {
    items,
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getReceivedConnectionRequests(actor, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const total = await prisma.userConnection.count({
    where: {
      receiverUserId: actor.id,
      status: 'PENDING',
    },
  });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.userConnection.findMany({
    where: {
      receiverUserId: actor.id,
      status: 'PENDING',
    },
    include: {
      requesterUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
          networkPrivacySettings: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: await Promise.all(rows.map(async (row) => ({
      requestId: row.id,
      sentAt: row.createdAt.toISOString(),
      source: row.source,
      profile: await serializeProfessionalCard(actor, row.requesterUser, {
        connectionStatus: {
          status: 'PENDING',
          blockedByActor: false,
          connection: row,
          connectedAt: null,
        },
      }),
    }))),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getSentConnectionRequests(actor, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const total = await prisma.userConnection.count({
    where: {
      requesterUserId: actor.id,
      status: 'PENDING',
    },
  });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.userConnection.findMany({
    where: {
      requesterUserId: actor.id,
      status: 'PENDING',
    },
    include: {
      receiverUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
          networkPrivacySettings: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: await Promise.all(rows.map(async (row) => ({
      requestId: row.id,
      sentAt: row.createdAt.toISOString(),
      source: row.source,
      profile: await serializeProfessionalCard(actor, row.receiverUser, {
        connectionStatus: {
          status: 'PENDING',
          blockedByActor: false,
          connection: row,
          connectedAt: null,
        },
      }),
    }))),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getNetworkPrivacy(actor) {
  const settings = await prisma.networkPrivacySettings.findUnique({
    where: { userId: actor.id },
  });

  const effective = getEffectivePrivacy({ ...actor, networkPrivacySettings: settings });
  return {
    settings: effective,
  };
}

export async function updateNetworkPrivacy(actor, payload) {
  const settings = await prisma.networkPrivacySettings.upsert({
    where: { userId: actor.id },
    create: {
      userId: actor.id,
      allowConnectionRequestsFrom: payload.allowConnectionRequestsFrom || 'EVERYONE',
      connectionVisibility: payload.connectionVisibility || 'CONNECTIONS_ONLY',
      showInPeopleSearch: payload.showInPeopleSearch ?? true,
      showRecruiterIdentity: payload.showRecruiterIdentity ?? true,
    },
    update: {
      allowConnectionRequestsFrom: payload.allowConnectionRequestsFrom ?? undefined,
      connectionVisibility: payload.connectionVisibility ?? undefined,
      showInPeopleSearch: payload.showInPeopleSearch ?? undefined,
      showRecruiterIdentity: payload.showRecruiterIdentity ?? undefined,
    },
  });

  return {
    settings,
  };
}

export async function sendConnectionRequest(actor, payload) {
  if (!payload?.targetUserId) {
    throw createHttpError('Target user is required.', 422);
  }

  const target = await findUserOrThrow(payload.targetUserId);
  if (actor.id === target.id) {
    throw createHttpError('You cannot connect with yourself.', 422);
  }

  const blockedRelationship = await getBlockedRelationship(actor.id, target.id);
  if (blockedRelationship) {
    throw createHttpError('Connection requests are unavailable for this user.', 403);
  }

  if (!canSendConnectionRequest(actor, target)) {
    throw createHttpError('This user is not accepting connection requests.', 403);
  }

  const pairKey = buildPairKey(actor.id, target.id);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.userConnection.findUnique({
      where: { pairKey },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return { connection: existing, created: false };
      }
      if (existing.status === 'PENDING') {
        if (existing.requesterUserId === actor.id) {
          return { connection: existing, created: false };
        }
        throw createHttpError('This user already sent you a request.', 409, { code: 'INCOMING_PENDING_REQUEST' });
      }

      const connection = await tx.userConnection.update({
        where: { id: existing.id },
        data: {
          requesterUserId: actor.id,
          receiverUserId: target.id,
          status: 'PENDING',
          source: payload.source || 'PROFILE',
          acceptedAt: null,
        },
      });
      return { connection, created: true };
    }

    const connection = await tx.userConnection.create({
      data: {
        requesterUserId: actor.id,
        receiverUserId: target.id,
        pairKey,
        status: 'PENDING',
        source: payload.source || 'PROFILE',
      },
    });
    return { connection, created: true };
  });

  if (result.created && result.connection.status === 'PENDING' && result.connection.requesterUserId === actor.id) {
    await createNotification({
      recipientUserId: target.id,
      type: 'NETWORK',
      title: 'New connection request',
      message: `${getProfileName(actor)} sent you a connection request.`,
      entityType: 'UserConnection',
      entityId: result.connection.id,
      metadata: {
        requesterUserId: actor.id,
        requesterName: getProfileName(actor),
        source: result.connection.source,
      },
    });
  }

  return {
    requestId: result.connection.id,
    status: result.connection.status,
  };
}

export async function acceptConnectionRequest(actor, requestId) {
  const connection = await prisma.userConnection.findUnique({
    where: { id: requestId },
  });

  if (!connection || connection.receiverUserId !== actor.id || connection.status !== 'PENDING') {
    throw createHttpError('Connection request not found.', 404);
  }

  const updated = await prisma.userConnection.update({
    where: { id: requestId },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });

  await createNotification({
    recipientUserId: updated.requesterUserId,
    type: 'NETWORK',
    title: 'Connection accepted',
    message: `${getProfileName(actor)} accepted your connection request.`,
    entityType: 'UserConnection',
    entityId: updated.id,
    metadata: {
      accepterUserId: actor.id,
      accepterName: getProfileName(actor),
    },
  });

  return {
    connectionId: updated.id,
    status: updated.status,
    acceptedAt: toIso(updated.acceptedAt),
  };
}

export async function declineConnectionRequest(actor, requestId) {
  const connection = await prisma.userConnection.findUnique({
    where: { id: requestId },
  });

  if (!connection || connection.receiverUserId !== actor.id || connection.status !== 'PENDING') {
    throw createHttpError('Connection request not found.', 404);
  }

  const updated = await prisma.userConnection.update({
    where: { id: requestId },
    data: {
      status: 'DECLINED',
      acceptedAt: null,
    },
  });

  return {
    requestId: updated.id,
    status: updated.status,
  };
}

export async function withdrawConnectionRequest(actor, requestId) {
  const connection = await prisma.userConnection.findUnique({
    where: { id: requestId },
  });

  if (!connection || connection.requesterUserId !== actor.id || connection.status !== 'PENDING') {
    throw createHttpError('Connection request not found.', 404);
  }

  const updated = await prisma.userConnection.update({
    where: { id: requestId },
    data: {
      status: 'WITHDRAWN',
      acceptedAt: null,
    },
  });

  return {
    requestId: updated.id,
    status: updated.status,
  };
}

export async function removeConnection(actor, connectionId) {
  const connection = await prisma.userConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.status !== 'ACCEPTED') {
    throw createHttpError('Connection not found.', 404);
  }

  if (![connection.requesterUserId, connection.receiverUserId].includes(actor.id)) {
    throw createHttpError('Connection not found.', 404);
  }

  await prisma.userConnection.delete({
    where: { id: connectionId },
  });

  return { removed: true };
}

export async function blockUser(actor, targetUserId) {
  await findUserOrThrow(targetUserId);
  if (actor.id === targetUserId) {
    throw createHttpError('You cannot block yourself.', 422);
  }

  await prisma.$transaction(async (tx) => {
    await tx.userBlock.upsert({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: actor.id,
          blockedUserId: targetUserId,
        },
      },
      create: {
        blockerUserId: actor.id,
        blockedUserId: targetUserId,
      },
      update: {},
    });

    const existingConnection = await tx.userConnection.findUnique({
      where: { pairKey: buildPairKey(actor.id, targetUserId) },
    });

    if (existingConnection) {
      await tx.userConnection.delete({
        where: { id: existingConnection.id },
      });
    }
  });

  return { blocked: true };
}

export async function unblockUser(actor, targetUserId) {
  await prisma.userBlock.deleteMany({
    where: {
      blockerUserId: actor.id,
      blockedUserId: targetUserId,
    },
  });

  return { blocked: false };
}

export async function getMutualConnections(actor, targetUserId, filters = {}) {
  const target = await findUserOrThrow(targetUserId);
  const status = await getConnectionStatusDetails(actor.id, target.id);
  if (!canViewMutualConnections(actor, target, status.status)) {
    throw createHttpError('Connections are not visible for this user.', 403);
  }

  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const mutualIds = await getMutualConnectionIds(actor.id, target.id);
  const total = mutualIds.length;
  const page = clampPage(total, requestedPage, pageSize);
  const pageIds = paginateRows(mutualIds, page, pageSize);

  const users = await prisma.user.findMany({
    where: { id: { in: pageIds } },
    include: {
      candidateProfile: true,
      recruiterProfile: { include: { organisation: true } },
      networkPrivacySettings: true,
    },
  });

  const userMap = new Map(users.map((user) => [user.id, user]));

  return {
    items: await Promise.all(pageIds.map((userId) => serializeProfessionalCard(actor, userMap.get(userId)))),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function searchPeople(actor, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const blockedRows = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerUserId: actor.id },
        { blockedUserId: actor.id },
      ],
    },
    select: {
      blockerUserId: true,
      blockedUserId: true,
    },
  });
  const blockedIds = new Set(blockedRows.flatMap((row) => [row.blockerUserId, row.blockedUserId]));
  const candidates = (await loadSearchCandidates(actor, filters))
    .filter((user) => !blockedIds.has(user.id));

  const rows = await Promise.all(candidates.map(async (user) => {
    const status = await getConnectionStatusDetails(actor.id, user.id);
    if (filters.connectionState && filters.connectionState !== status.status) {
      return null;
    }
    const rank = scoreSearchCandidate(user, filters);
    const card = await serializeProfessionalCard(actor, user, { connectionStatus: status });
    return { rank, card };
  }));

  const sorted = rows
    .filter(Boolean)
    .sort((left, right) => right.rank.score - left.rank.score || left.card.fullName.localeCompare(right.card.fullName));
  const total = sorted.length;
  const page = clampPage(total, requestedPage, pageSize);

  return {
    items: paginateRows(sorted, page, pageSize).map((item) => item.card),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getNetworkSuggestions(actor, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const [acceptedConnectionIds, blockedRows, pool] = await Promise.all([
    getAcceptedConnectionIds(actor.id),
    prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerUserId: actor.id },
          { blockedUserId: actor.id },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { candidateProfile: { isNot: null } },
          { recruiterProfile: { isNot: null } },
        ],
      },
      include: {
        candidateProfile: true,
        recruiterProfile: { include: { organisation: true } },
        networkPrivacySettings: true,
      },
      take: SUGGESTION_CANDIDATE_WINDOW,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const blockedIds = new Set(blockedRows.flatMap((row) => [row.blockerUserId, row.blockedUserId]));
  const candidates = pool.filter((user) => (
    user.id !== actor.id
    && !acceptedConnectionIds.has(user.id)
    && !blockedIds.has(user.id)
    && canSearchTarget(actor, user)
    && canSendConnectionRequest(actor, user)
  ));

  const ranked = await Promise.all(candidates.map(async (user) => {
    const mutualIds = await getMutualConnectionIds(actor.id, user.id);
    const suggestion = scoreSuggestion(actor, user, mutualIds.length);
    const profile = await serializeProfessionalCard(actor, user, {
      mutualConnectionIds: mutualIds,
      connectionStatus: {
        status: 'NONE',
        blockedByActor: false,
        connection: null,
        connectedAt: null,
      },
    });
    return {
      score: suggestion.score,
      reason: suggestion.reason,
      explanations: suggestion.explanations,
      profile,
    };
  }));

  const sorted = ranked
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.profile.fullName.localeCompare(right.profile.fullName));
  const total = sorted.length;
  const page = clampPage(total, requestedPage, pageSize);

  return {
    items: paginateRows(sorted, page, pageSize).map((item) => ({
      score: item.score,
      reason: item.reason,
      explanations: item.explanations,
      profile: item.profile,
    })),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function getProfessionalProfile(actor, targetUserId) {
  const target = await findUserOrThrow(targetUserId);
  const status = await getConnectionStatusDetails(actor.id, target.id);
  if (status.status === 'BLOCKED') {
    throw createHttpError('Profile unavailable.', 404);
  }

  const canView = actor.id === target.id || canSearchTarget(actor, target) || status.status === 'ACCEPTED' || status.status === 'PENDING';
  if (!canView) {
    throw createHttpError('Profile unavailable.', 404);
  }

  const mutualIds = await getMutualConnectionIds(actor.id, target.id);
  const profile = await serializeProfessionalCard(actor, target, {
    connectionStatus: status,
    mutualConnectionIds: mutualIds,
  });

  return {
    profile,
    about: target.candidateProfile?.summary || target.recruiterProfile?.aboutCompany || null,
    visibility: getEffectivePrivacy(target),
    messaging: buildMessageCapability(status.status),
  };
}

export async function followCompany(actor, organisationId) {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
  });
  if (!organisation) throw createHttpError('Organisation not found.', 404);

  await prisma.companyFollow.upsert({
    where: {
      userId_organisationId: {
        userId: actor.id,
        organisationId,
      },
    },
    create: {
      userId: actor.id,
      organisationId,
    },
    update: {},
  });

  return { following: true };
}

export async function unfollowCompany(actor, organisationId) {
  await prisma.companyFollow.deleteMany({
    where: {
      userId: actor.id,
      organisationId,
    },
  });
  return { following: false };
}

export async function getCompanyFollowStatus(actorUserId, organisationId) {
  if (!actorUserId || !organisationId) return false;
  const row = await prisma.companyFollow.findUnique({
    where: {
      userId_organisationId: {
        userId: actorUserId,
        organisationId,
      },
    },
  });
  return Boolean(row);
}

export async function listOrganisationRecruitersForNetwork(actor, organisationId, limit = 6) {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['RECRUITER', 'RECRUITER_ADMIN'] },
      recruiterProfile: {
        is: { organisationId },
      },
    },
    include: {
      recruiterProfile: {
        include: { organisation: true },
      },
      candidateProfile: true,
      networkPrivacySettings: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const visibleRows = rows.filter((user) => canSearchTarget(actor, user));
  return Promise.all(visibleRows.map((user) => serializeProfessionalCard(actor, user)));
}

export async function enrichJobWithNetworkContext(job, actor = null) {
  if (!job?.recruiterId) return job;
  const recruiter = await prisma.user.findUnique({
    where: { id: job.recruiterId },
    include: {
      recruiterProfile: {
        include: { organisation: true },
      },
      candidateProfile: true,
      networkPrivacySettings: true,
    },
  });

  if (!recruiter) return job;
  const recruiterCard = actor ? await serializeProfessionalCard(actor, recruiter) : {
    userId: recruiter.id,
    fullName: getProfileName(recruiter),
    designation: recruiter.recruiterProfile?.designation || null,
    company: recruiter.recruiterProfile?.companyName || recruiter.recruiterProfile?.organisation?.name || null,
    location: recruiter.recruiterProfile?.headquartersLocation || recruiter.recruiterProfile?.organisation?.headquarters || null,
    headline: recruiter.recruiterProfile?.designation || recruiter.recruiterProfile?.industryDomain || null,
    connectionStatus: actor ? 'NONE' : null,
  };

  return {
    ...job,
    recruiter: recruiterCard,
  };
}
