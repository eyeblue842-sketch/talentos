import { prisma } from '../config/db.js';

function calculateCompletion(payload) {
  const sections = [payload.personal, payload.education, payload.experience, payload.skills, payload.projects];
  const completed = sections.filter((section) => Array.isArray(section) ? section.length : Object.keys(section || {}).length).length;
  return Math.round((completed / sections.length) * 100);
}

export async function upsertResumeBuilder(candidateId, payload) {
  const completedScore = calculateCompletion(payload);
  return prisma.resumeBuilder.upsert({
    where: { candidateId },
    update: { ...payload, completedScore },
    create: { candidateId, ...payload, completedScore },
  });
}

export async function getResumeBuilder(candidateId) {
  return prisma.resumeBuilder.findUnique({ where: { candidateId } });
}
