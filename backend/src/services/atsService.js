import dayjs from 'dayjs';
import { prisma } from '../config/db.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail } from './emailService.js';

const stageLabelMap = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

export async function applyToJob(candidateId, payload) {
  const [job, candidate] = await Promise.all([
    prisma.job.findUnique({ where: { id: payload.jobId } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
  ]);

  const matchScore = buildKeywordMatch(job.skillsRequired, candidate.skills);

  const application = await prisma.application.create({
    data: {
      jobId: payload.jobId,
      candidateId,
      coverLetter: payload.coverLetter,
      matchScore,
      activities: {
        create: { message: 'Application submitted.' },
      },
    },
    include: { job: true, candidate: true },
  });

  return application;
}

export async function getRecruiterPipeline(recruiterId) {
  return prisma.application.findMany({
    where: { job: { recruiterId } },
    include: {
      candidate: true,
      job: true,
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function updatePipelineStage(applicationId, recruiterId, stage) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { recruiterId } },
    include: { candidate: { include: { user: true } }, job: true },
  });

  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      statusLabel: stageLabelMap[stage],
      activities: {
        create: { message: `Moved to ${stageLabelMap[stage]}.` },
      },
    },
    include: { candidate: { include: { user: true } }, job: true, activities: true, notes: true },
  });

  await sendPipelineEmail(application.candidate.user.email, stage, application.job.title);
  return updated;
}

export async function scheduleInterview(applicationId, recruiterId, payload) {
  const date = dayjs(payload.interviewScheduledAt).toDate();
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: 'INTERVIEW_SCHEDULED',
      statusLabel: 'Interview',
      interviewScheduledAt: date,
      interviewerName: payload.interviewerName,
      activities: {
        create: {
          message: `Interview scheduled with ${payload.interviewerName} on ${dayjs(date).format('DD MMM YYYY, hh:mm A')}.`,
        },
      },
    },
    include: { candidate: { include: { user: true } }, job: true },
  });

  await sendPipelineEmail(updated.candidate.user.email, 'INTERVIEW_SCHEDULED', updated.job.title, {
    interviewScheduledAt: date,
    interviewerName: payload.interviewerName,
  });

  return updated;
}

export async function addAtsNote(applicationId, authorId, content) {
  return prisma.atsNote.create({
    data: { applicationId, authorId, content },
    include: { author: true },
  });
}

export async function getCandidateApplications(candidateId) {
  return prisma.application.findMany({
    where: { candidateId },
    include: { job: { include: { recruiter: { include: { recruiterProfile: true } } } }, activities: true },
    orderBy: { appliedAt: 'desc' },
  });
}
