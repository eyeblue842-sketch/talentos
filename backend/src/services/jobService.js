import slugify from 'slugify';
import { prisma } from '../config/db.js';

export async function createJob(recruiterId, payload) {
  return prisma.job.create({
    data: {
      recruiterId,
      title: payload.title,
      slug: slugify(`${payload.title}-${Date.now()}`, { lower: true, strict: true }),
      description: payload.description,
      skillsRequired: payload.skillsRequired,
      experienceMin: payload.experienceMin,
      experienceMax: payload.experienceMax,
      salaryMin: payload.salaryMin,
      salaryMax: payload.salaryMax,
      location: payload.location,
      employmentType: payload.employmentType || 'FULL_TIME',
      status: payload.status || 'OPEN',
    },
  });
}

export async function listRecruiterJobs(recruiterId) {
  return prisma.job.findMany({
    where: { recruiterId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { applications: true } } },
  });
}

export async function updateJob(jobId, recruiterId, payload) {
  const existingJob = await prisma.job.findFirst({
    where: { id: jobId, recruiterId },
  });

  if (!existingJob) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.job.update({
    where: { id: jobId },
    data: payload,
  });
}

export async function deleteJob(jobId, recruiterId) {
  const existingJob = await prisma.job.findFirst({
    where: { id: jobId, recruiterId },
  });

  if (!existingJob) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.job.delete({ where: { id: jobId } });
}

export async function browseJobs(filters = {}) {
  return prisma.job.findMany({
    where: {
      status: 'OPEN',
      title: filters.keyword ? { contains: filters.keyword, mode: 'insensitive' } : undefined,
      location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
      skillsRequired: filters.skill ? { has: filters.skill } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: { recruiter: { include: { recruiterProfile: true } } },
  });
}
