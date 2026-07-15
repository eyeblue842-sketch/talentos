import dayjs from 'dayjs';
import { prisma } from '../config/db.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail } from './emailService.js';
import { serializeApplication, serializeAtsNote } from '../serializers/index.js';

const stageLabelMap = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

async function getApplicationWithRelations(applicationId) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: { include: { user: true } },
      job: true,
      notes: {
        include: {
          author: {
            include: { recruiterProfile: true, candidateProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: { orderBy: { createdAt: 'desc' } },
    },
  });
}

async function assertRecruiterOwnsApplication(applicationId, recruiterId) {
  const application = await getApplicationWithRelations(applicationId);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  if (application.job.recruiterId !== recruiterId) {
    const error = new Error('You are not allowed to access this application.');
    error.statusCode = 403;
    throw error;
  }

  return application;
}

export async function applyToJob(candidateId, payload) {
  const [job, candidate] = await Promise.all([
    prisma.job.findUnique({ where: { id: payload.jobId } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
  ]);

  if (!job || job.status !== 'OPEN') {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!candidate) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

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
    include: { job: true, candidate: true, activities: true, notes: true },
  });

  return serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function getRecruiterPipeline(recruiterId) {
  const applications = await prisma.application.findMany({
    where: { job: { recruiterId } },
    include: {
      candidate: true,
      job: true,
      notes: {
        include: {
          author: { include: { recruiterProfile: true, candidateProfile: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true }));
}

export async function updatePipelineStage(applicationId, recruiterId, stage) {
  const application = await assertRecruiterOwnsApplication(applicationId, recruiterId);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      statusLabel: stageLabelMap[stage],
      activities: {
        create: { message: `Moved to ${stageLabelMap[stage]}.` },
      },
    },
    include: {
      candidate: { include: { user: true } },
      job: true,
      activities: true,
      notes: {
        include: { author: { include: { recruiterProfile: true, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  await sendPipelineEmail(application.candidate.user.email, stage, application.job.title);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function scheduleInterview(applicationId, recruiterId, payload) {
  await assertRecruiterOwnsApplication(applicationId, recruiterId);
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
    include: { candidate: { include: { user: true } }, job: true, activities: true, notes: true },
  });

  await sendPipelineEmail(updated.candidate.user.email, 'INTERVIEW_SCHEDULED', updated.job.title, {
    interviewScheduledAt: date,
    interviewerName: payload.interviewerName,
  });

  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function addAtsNote(applicationId, recruiterId, content) {
  await assertRecruiterOwnsApplication(applicationId, recruiterId);
  const note = await prisma.atsNote.create({
    data: { applicationId, authorId: recruiterId, content },
    include: {
      author: { include: { recruiterProfile: true, candidateProfile: true } },
    },
  });

  return serializeAtsNote(note);
}

export async function getCandidateApplications(candidateId) {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    include: {
      job: { include: { recruiter: { include: { recruiterProfile: true } } } },
      candidate: true,
      activities: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true }));
}
