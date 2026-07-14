import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { storeResume } from '../config/storage.js';
import { indexCandidateResume } from './searchService.js';

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export async function uploadCandidateResume(candidateId, file) {
  const resumeUrl = await storeResume(file);
  const candidate = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: { resumeUrl },
  });

  await indexCandidateResume(candidate);
  return candidate;
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
  return candidate;
}

export async function saveCandidateForRecruiter(recruiterProfileId, candidateId, tag) {
  return prisma.savedCandidate.upsert({
    where: { recruiterId_candidateId: { recruiterId: recruiterProfileId, candidateId } },
    update: { tag },
    create: { recruiterId: recruiterProfileId, candidateId, tag },
  });
}

export async function getSavedCandidates(recruiterProfileId) {
  return prisma.savedCandidate.findMany({
    where: { recruiterId: recruiterProfileId },
    include: { candidate: true },
    orderBy: { createdAt: 'desc' },
  });
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
  JSON.parse(JSON.stringify(resumeBuilder.experience || [])).forEach((item) => {
    doc.fontSize(12).text(`${item.role || ''} - ${item.company || ''}`);
    doc.fontSize(10).text(item.summary || '');
    doc.moveDown(0.5);
  });
  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
