import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { indexCandidateResume } from './searchService.js';
import {
  serializeCandidateProfile,
  serializeSavedCandidate,
} from '../serializers/index.js';
import { requireOrganisationContext } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { uploadCandidateResumeAsset } from './applicationWorkflowService.js';
import { readPrivateFileNodeStream } from '../config/storage.js';
import { openLegacyResumeFile } from './legacyResumeService.js';

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export async function uploadCandidateResume(candidateUser, file) {
  const asset = await uploadCandidateResumeAsset(candidateUser, file, { kind: 'RESUME' });
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateUser.candidateProfile.id },
  });
  await indexCandidateResume(candidate);
  return {
    profile: serializeCandidateProfile(candidate, { includePrivate: true }),
    resume: asset,
  };
}

export async function saveCandidateProfile(candidateId, payload) {
  const candidate = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      ...payload,
      skills: payload.skills ? normalizeStringArray(payload.skills) : undefined,
      preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
      totalExperience: payload.totalExperience !== undefined ? Number(payload.totalExperience) : undefined,
      currentCtcLpa: payload.currentCtcLpa !== undefined ? Number(payload.currentCtcLpa) : undefined,
      expectedCtcLpa: payload.expectedCtcLpa !== undefined ? Number(payload.expectedCtcLpa) : undefined,
    },
  });

  await indexCandidateResume(candidate);
  return serializeCandidateProfile(candidate, { includePrivate: true });
}

export async function saveCandidateForRecruiter(actorUser, candidateId, organisationId = null, tag = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  const savedCandidate = await prisma.savedCandidate.upsert({
    where: { recruiterId_candidateId: { recruiterId: actorUser.recruiterProfile.id, candidateId } },
    update: {
      organisationId: context.organisationId,
      tag,
    },
    create: {
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      candidateId,
      tag,
    },
    include: { candidate: true },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'candidate.save',
    entityType: 'SavedCandidate',
    entityId: savedCandidate.id,
    afterData: savedCandidate,
    ...requestMeta,
  });

  return serializeSavedCandidate(savedCandidate, { minimalCandidate: true });
}

export async function removeSavedCandidate(actorUser, candidateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const savedCandidate = await prisma.savedCandidate.findFirst({
    where: {
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      candidateId,
    },
  });

  if (!savedCandidate) {
    const error = new Error('Saved candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.savedCandidate.delete({ where: { id: savedCandidate.id } });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'candidate.unsave',
    entityType: 'SavedCandidate',
    entityId: savedCandidate.id,
    beforeData: savedCandidate,
    ...requestMeta,
  });

  return { deleted: true };
}

export async function getSavedCandidates(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const where = {
    organisationId: context.organisationId,
    tag: filters.tag || undefined,
  };

  const [total, savedCandidates] = await Promise.all([
    prisma.savedCandidate.count({ where }),
    prisma.savedCandidate.findMany({
      where,
      include: { candidate: true, recruiter: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: savedCandidates.map((item) => ({
      ...serializeSavedCandidate(item, { minimalCandidate: true }),
      savedBy: item.recruiter?.user ? { id: item.recruiter.user.id, email: item.recruiter.user.email } : undefined,
    })),
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function generateResumePdf(candidate, resumeBuilder) {
  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.fontSize(22).text(candidate.fullName);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`${candidate.location || ''} | ${candidate.summary || ''}`);
  doc.moveDown();
  doc.fontSize(16).text('Skills');
  doc.fontSize(11).text(candidate.skills.join(', '));
  doc.moveDown();
  doc.fontSize(16).text('Experience');
  JSON.parse(JSON.stringify(resumeBuilder?.experience || [])).forEach((item) => {
    doc.fontSize(12).text(`${item.role || ''} - ${item.company || ''}`);
    doc.fontSize(10).text(item.summary || '');
    doc.moveDown(0.5);
  });
  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function getCandidateResumeDownload(actorUser, candidateId, organisationId = null, requestMeta = {}) {
  let candidate;

  if (actorUser.role === 'CANDIDATE') {
    if (actorUser.candidateProfile.id !== candidateId) {
      const error = new Error('Resume not found.');
      error.statusCode = 404;
      throw error;
    }
    candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
    });
  } else {
    const context = await requireOrganisationContext(actorUser, organisationId);
    candidate = await prisma.candidateProfile.findFirst({
      where: {
        id: candidateId,
        OR: [
          { applications: { some: { organisationId: context.organisationId } } },
          { savedByRecruiters: { some: { organisationId: context.organisationId } } },
        ],
      },
    });
  }

  if (!candidate) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }

  if (candidate.latestResumeAssetId) {
    const asset = await prisma.resumeAsset.findUnique({ where: { id: candidate.latestResumeAssetId } });
    if (!asset) {
      const error = new Error('Resume not found.');
      error.statusCode = 404;
      throw error;
    }
    await recordAuditLog({
      organisationId: organisationId || null,
      actorUserId: actorUser.id,
      action: 'resume.download',
      entityType: 'ResumeAsset',
      entityId: asset.id,
      metadata: { candidateId, mode: 'private-asset' },
      ...requestMeta,
    });
    return {
      filename: asset.originalFilename,
      mimeType: asset.mimeType,
      contentLength: asset.sizeBytes,
      stream: readPrivateFileNodeStream(asset.storageProvider, asset.storageKey).stream,
    };
  }

  if (!candidate.resumeUrl) {
    const error = new Error('Resume not found.');
    error.statusCode = 404;
    throw error;
  }

  const file = openLegacyResumeFile(candidate.resumeUrl);
  await recordAuditLog({
    organisationId: organisationId || null,
    actorUserId: actorUser.id,
    action: 'resume.download',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: { candidateId, mode: 'legacy-compatibility' },
    ...requestMeta,
  });

  return {
    filename: file.filename,
    mimeType: 'application/octet-stream',
    contentLength: file.contentLength,
    stream: file.stream,
  };
}
