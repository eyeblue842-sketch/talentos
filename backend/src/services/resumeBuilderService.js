import { prisma } from '../config/db.js';
import { serializeResumeBuilder } from '../serializers/index.js';

function calculateCompletion(payload) {
  const sections = [payload.personal, payload.education, payload.experience, payload.skills, payload.projects];
  const completed = sections.filter((section) => Array.isArray(section) ? section.length : Object.keys(section || {}).length).length;
  return Math.round((completed / sections.length) * 100);
}

export async function upsertResumeBuilder(candidateId, payload) {
  const completedScore = calculateCompletion(payload);
  const resumeBuilder = await prisma.resumeBuilder.upsert({
    where: { candidateId },
    update: { ...payload, completedScore },
    create: { candidateId, ...payload, completedScore },
  });
  return serializeResumeBuilder(resumeBuilder);
}

export async function getResumeBuilder(candidateId) {
  const resumeBuilder = await prisma.resumeBuilder.findUnique({ where: { candidateId } });
  return serializeResumeBuilder(resumeBuilder);
}
