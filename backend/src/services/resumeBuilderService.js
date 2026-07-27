import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { markCandidateIntelligenceStale } from '../intelligence/services/candidateIntelligenceService.js';

function ensureHttpsOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid Resume Builder base URL.');
  }
  url.hash = '';
  return url;
}

function buildExternalUrl(pathname, searchParams = {}) {
  if (!env.resumeBuilderEnabled || !env.resumeBuilderBaseUrl) return null;
  const base = ensureHttpsOrigin(env.resumeBuilderBaseUrl);
  const url = new URL(pathname, base);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function sanitizeExternalResumeUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  const configuredBase = ensureHttpsOrigin(env.resumeBuilderBaseUrl);
  if (!configuredBase) {
    const error = new Error('Resume Builder is not configured.');
    error.statusCode = 409;
    throw error;
  }

  if (url.origin !== configuredBase.origin) {
    const error = new Error('Unsupported Resume Builder destination.');
    error.statusCode = 422;
    throw error;
  }

  return url.toString();
}

function buildBuilderState(profile, resumes = []) {
  const primaryExternalResume = resumes.find((resume) => resume.source === 'EXTERNAL_BUILDER' && resume.externalResumeId);
  return {
    enabled: env.resumeBuilderEnabled && Boolean(env.resumeBuilderBaseUrl),
    clientIdConfigured: Boolean(env.resumeBuilderClientId),
    baseUrl: env.resumeBuilderEnabled ? env.resumeBuilderBaseUrl : null,
    links: {
      create: buildExternalUrl('/create', { source: 'careeriz' }),
      manage: buildExternalUrl('/dashboard', { source: 'careeriz' }),
      edit: primaryExternalResume?.externalResumeId
        ? buildExternalUrl(`/resume/${encodeURIComponent(primaryExternalResume.externalResumeId)}/edit`)
        : null,
    },
    integrationMode: env.resumeBuilderEnabled ? 'DEEP_LINK' : 'DISABLED',
    primaryExternalResume: primaryExternalResume ? {
      id: primaryExternalResume.id,
      externalResumeId: primaryExternalResume.externalResumeId,
      externalResumeUrl: primaryExternalResume.externalResumeUrl,
      externalResumeVersion: primaryExternalResume.externalResumeVersion,
      lastSynchronizedAt: primaryExternalResume.lastSynchronizedAt?.toISOString?.() || primaryExternalResume.lastSynchronizedAt || null,
    } : null,
    disabledReason: env.resumeBuilderEnabled ? null : 'Resume Builder is not configured for this environment.',
    profileVisibility: profile?.profileVisibility || 'PRIVATE',
  };
}

export async function getResumeBuilder(candidateUser) {
  const resumes = await prisma.resumeAsset.findMany({
    where: {
      candidateId: candidateUser.candidateProfile.id,
      kind: 'RESUME',
      status: { not: 'DELETED' },
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
  });

  return buildBuilderState(candidateUser.candidateProfile, resumes);
}

export async function upsertResumeBuilder(candidateUser, payload = {}, requestMeta = {}) {
  if (!payload.externalResumeId && !payload.externalResumeUrl && !payload.externalResumeVersion) {
    return getResumeBuilder(candidateUser);
  }

  const now = new Date();
  const existingPrimary = await prisma.resumeAsset.findFirst({
    where: {
      candidateId: candidateUser.candidateProfile.id,
      kind: 'RESUME',
      source: 'EXTERNAL_BUILDER',
      externalResumeId: payload.externalResumeId || undefined,
      status: { not: 'DELETED' },
    },
  });

  const externalResumeUrl = payload.externalResumeUrl ? sanitizeExternalResumeUrl(payload.externalResumeUrl) : null;

  const asset = existingPrimary
    ? await prisma.resumeAsset.update({
        where: { id: existingPrimary.id },
        data: {
          source: 'EXTERNAL_BUILDER',
          status: 'ACTIVE',
          isPrimary: true,
          externalResumeId: payload.externalResumeId || existingPrimary.externalResumeId,
          externalResumeUrl: externalResumeUrl || existingPrimary.externalResumeUrl,
          externalResumeVersion: payload.externalResumeVersion || existingPrimary.externalResumeVersion,
          lastSynchronizedAt: now,
          parsingStatus: existingPrimary.parsingStatus || 'PENDING',
        },
      })
    : await prisma.resumeAsset.create({
        data: {
          candidateId: candidateUser.candidateProfile.id,
          ownerUserId: candidateUser.id,
          kind: 'RESUME',
          source: 'EXTERNAL_BUILDER',
          status: 'ACTIVE',
          isPrimary: true,
          storageKey: `external/${payload.externalResumeId || now.getTime()}`,
          storageProvider: 'external',
          originalFilename: `resume-${payload.externalResumeId || now.getTime()}.url`,
          mimeType: 'application/vnd.careeriz.external-resume',
          sizeBytes: 0,
          externalResumeId: payload.externalResumeId || null,
          externalResumeUrl,
          externalResumeVersion: payload.externalResumeVersion || null,
          lastSynchronizedAt: now,
          parsingStatus: 'PENDING',
        },
      });

  await prisma.resumeAsset.updateMany({
    where: {
      candidateId: candidateUser.candidateProfile.id,
      kind: 'RESUME',
      id: { not: asset.id },
      isPrimary: true,
    },
    data: { isPrimary: false },
  });

  await prisma.candidateProfile.update({
    where: { id: candidateUser.candidateProfile.id },
    data: {
      latestResumeAssetId: asset.id,
      resumeUrl: asset.externalResumeUrl || null,
    },
  });
  await markCandidateIntelligenceStale(candidateUser.candidateProfile.id, 'RESUME_BUILDER_UPDATED');

  await recordAuditLog({
    actorUserId: candidateUser.id,
    action: 'candidate.resume-builder.link',
    entityType: 'ResumeAsset',
    entityId: asset.id,
    metadata: {
      candidateId: candidateUser.candidateProfile.id,
      externalResumeId: asset.externalResumeId,
    },
    ...requestMeta,
  });

  return getResumeBuilder(candidateUser);
}
