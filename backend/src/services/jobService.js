import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { serializeJob } from '../serializers/index.js';

async function getJobById(jobId) {
  return prisma.job.findUnique({ where: { id: jobId } });
}

async function assertRecruiterOwnsJob(jobId, recruiterId) {
  const job = await getJobById(jobId);
  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  if (job.recruiterId !== recruiterId) {
    const error = new Error('You are not allowed to access this job.');
    error.statusCode = 403;
    throw error;
  }

  return job;
}

export async function createJob(recruiterId, payload) {
  const job = await prisma.job.create({
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

  return serializeJob(job);
}

export async function listRecruiterJobs(recruiterId) {
  const jobs = await prisma.job.findMany({
    where: { recruiterId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { applications: true } } },
  });

  return jobs.map((job) => serializeJob(job));
}

export async function updateJob(jobId, recruiterId, payload) {
  await assertRecruiterOwnsJob(jobId, recruiterId);

  const job = await prisma.job.update({
    where: { id: jobId },
    data: payload,
  });

  return serializeJob(job);
}

export async function deleteJob(jobId, recruiterId) {
  await assertRecruiterOwnsJob(jobId, recruiterId);
  return prisma.job.delete({ where: { id: jobId } });
}

export async function browseJobs(filters = {}) {
  const jobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      title: filters.keyword ? { contains: filters.keyword, mode: 'insensitive' } : undefined,
      location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
      skillsRequired: filters.skill ? { has: filters.skill } : undefined,
    },
    orderBy: { createdAt: 'desc' },
    include: { recruiter: { include: { recruiterProfile: true } } },
  });

  return jobs.map((job) => serializeJob(job, { publicRecruiter: true }));
}
