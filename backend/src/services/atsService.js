import crypto from 'crypto';
import slugify from 'slugify';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { createJob } from './jobService.js';
import { addJobScreeningQuestion } from './applicationWorkflowService.js';
import { buildKeywordMatch } from './matchService.js';
import { sendPipelineEmail, sendRecruiterOutreachEmail, sendCandidateRejectionEmail } from './emailService.js';
import { serializeApplication, serializeAtsNote } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { recordAuditLog } from './auditLogService.js';
import { createNotification } from './notificationService.js';
import { cancelInterviewMeeting, scheduleInterviewMeeting } from '../meeting/meetingService.js';
import { touchCandidateLastActive } from './candidateActivityService.js';

const allowedStages = {
  APPLIED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED', 'APPLIED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED', 'SHORTLISTED'],
  SELECTED: ['OFFER', 'REJECTED'],
  OFFER: ['HIRED', 'OFFER_DECLINED', 'REJECTED', 'SELECTED'],
  HIRED: [],
  OFFER_DECLINED: [],
  REJECTED: [],
};

const readableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];

const stageLabelMap = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  SELECTED: 'Selected',
  OFFER: 'Offer',
  HIRED: 'Hired',
  OFFER_DECLINED: 'Offer Declined',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const recruiterResumeDbSourceName = 'Resume Database';

const candidateVisibleStatusMap = {
  APPLIED: 'Application Received',
  SHORTLISTED: 'Under Review',
  INTERVIEW_SCHEDULED: 'Interview Stage',
  SELECTED: 'Selected',
  OFFER: 'Offer Extended',
  HIRED: 'Hired',
  OFFER_DECLINED: 'Offer Declined',
  REJECTED: 'Application Closed',
  WITHDRAWN: 'Application Withdrawn',
};

function isMissingInterviewMeetingInfrastructure(error) {
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || error?.message?.includes('InterviewMeeting')
    || error?.message?.includes('interviewMeeting');
}

function generatePublicReference() {
  return crypto.randomBytes(10).toString('hex').slice(0, 10).toUpperCase();
}

async function getWritableOrganisationContext(actorUser, organisationId = null) {
  return requireOrganisationRole(actorUser, writableRoles, organisationId);
}

async function ensureRequirementJob(context, jobId, requisitionId = null) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      organisationId: context.organisationId,
      requisitionId: requisitionId || undefined,
    },
    include: {
      requisition: true,
    },
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return job;
}

async function ensureResumeCandidate(candidateId) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
    },
  });

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  return candidate;
}

async function buildResumeWorkflowApplication(tx, { organisationId, actorUser, candidate, job, stage, requestMeta = {} }) {
  const existing = await tx.application.findUnique({
    where: {
      jobId_candidateId: {
        jobId: job.id,
        candidateId: candidate.id,
      },
    },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  if (existing) {
    return { application: existing, duplicate: true, created: false };
  }

  const matchScore = buildKeywordMatch(job.skillsRequired || [], candidate.skills || []);
  const nextStage = stage || 'APPLIED';
  const statusLabel = stageLabelMap[nextStage] || stageLabelMap.APPLIED;
  const candidateStatusMessage = nextStage === 'SHORTLISTED'
    ? candidateVisibleStatusMap.SHORTLISTED
    : candidateVisibleStatusMap.APPLIED;

  const application = await tx.application.create({
    data: {
      organisationId,
      jobId: job.id,
      candidateId: candidate.id,
      currentStage: nextStage,
      statusLabel,
      recruiterTag: nextStage === 'SHORTLISTED' ? 'SHORTLISTED' : null,
      matchScore,
    },
  });

  const jobApplication = await tx.jobApplication.create({
    data: {
      publicReference: generatePublicReference(),
      organisationId,
      jobId: job.id,
      candidateId: candidate.id,
      applicationId: application.id,
      sourceType: 'API',
      sourceName: recruiterResumeDbSourceName,
      candidateStatusUpdatedAt: new Date(),
    },
  });

  await tx.applicationActivity.create({
    data: {
      organisationId,
      applicationId: application.id,
      actorUserId: actorUser.id,
      eventType: nextStage === 'SHORTLISTED' ? 'SHORTLISTED_FROM_RESUME_SEARCH' : 'ADDED_FROM_RESUME_SEARCH',
      message: nextStage === 'SHORTLISTED'
        ? 'Candidate shortlisted from resume database.'
        : 'Candidate added to ATS from resume database.',
      metadata: {
        sourceName: recruiterResumeDbSourceName,
      },
    },
  });

  await tx.applicationTimeline.create({
    data: {
      organisationId,
      applicationId: jobApplication.id,
      actorUserId: actorUser.id,
      eventType: nextStage,
      message: `${candidateStatusMessage} for ${job.title}.`,
      metadata: {
        sourceName: recruiterResumeDbSourceName,
      },
      isCandidateVisible: true,
    },
  });

  await tx.auditLog.create({
    data: {
      organisationId,
      actorUserId: actorUser.id,
      action: nextStage === 'SHORTLISTED' ? 'resume-search.shortlist' : 'resume-search.add-to-ats',
      entityType: 'Application',
      entityId: application.id,
      afterData: {
        jobId: job.id,
        candidateId: candidate.id,
        currentStage: nextStage,
        sourceName: recruiterResumeDbSourceName,
      },
      ipAddress: requestMeta.ipAddress || null,
      userAgent: requestMeta.userAgent || null,
    },
  });

  const fullApplication = await tx.application.findUnique({
    where: { id: application.id },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  return { application: fullApplication, duplicate: false, created: true };
}

async function createActivity(organisationId, applicationId, payload) {
  return prisma.applicationActivity.create({
    data: {
      organisationId,
      applicationId,
      actorUserId: payload.actorUserId || null,
      eventType: payload.eventType || null,
      message: payload.message,
      metadata: payload.metadata || null,
    },
  });
}

async function createCandidateTimeline(jobApplicationId, organisationId, actorUserId, eventType, message, metadata = {}) {
  const jobApplication = await prisma.jobApplication.findFirst({
    where: { applicationId: jobApplicationId },
    select: { id: true },
  });

  if (!jobApplication) return;

  await prisma.applicationTimeline.create({
    data: {
      organisationId,
      applicationId: jobApplication.id,
      actorUserId: actorUserId || null,
      eventType,
      message,
      metadata,
      isCandidateVisible: true,
    },
  });

  await prisma.jobApplication.update({
    where: { id: jobApplication.id },
    data: {
      candidateStatusUpdatedAt: new Date(),
    },
  });
}

async function createCandidateNotification(application, title, message, entityType = 'Application') {
  if (!application?.candidate?.user?.id) return;
  await createNotification({
    organisationId: application.organisationId,
    recipientUserId: application.candidate.user.id,
    type: 'APPLICATION',
    title,
    message,
    entityType,
    entityId: application.submittedApplication?.id || application.id,
    metadata: {
      applicationId: application.submittedApplication?.id || application.id,
    },
  });
}

async function getApplicationWithRelations(organisationId, applicationId) {
  return prisma.application.findFirst({
    where: { id: applicationId, organisationId },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: {
        include: {
          requisition: true,
          recruiter: true,
          hiringManager: true,
        },
      },
      submittedApplication: true,
      notes: {
        include: {
          author: {
            include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actorUser: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
  });
}

async function assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, readableRoles, organisationId);
  const application = await getApplicationWithRelations(context.organisationId, applicationId);
  if (!application) {
    const error = new Error('Application not found.');
    error.statusCode = 404;
    throw error;
  }

  return { context, application };
}

function ensureTransitionAllowed(currentStage, nextStage) {
  if (!allowedStages[currentStage]?.includes(nextStage)) {
    const error = new Error(`Transition from ${currentStage} to ${nextStage} is not allowed.`);
    error.statusCode = 422;
    throw error;
  }
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
      organisationId: job.organisationId,
      jobId: payload.jobId,
      candidateId,
      coverLetter: payload.coverLetter,
      matchScore,
      activities: {
        create: {
          organisationId: job.organisationId,
          eventType: 'APPLICATION_SUBMITTED',
          message: 'Application submitted.',
        },
      },
    },
    include: {
      job: { include: { requisition: true } },
      candidate: true,
      activities: { include: { actorUser: true } },
      notes: true,
      interviewProcesses: true,
    },
  });

  await touchCandidateLastActive(candidateId);

  return serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function getRecruiterPipeline(actorUser, filters = {}, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const applications = await prisma.application.findMany({
    where: {
      organisationId: context.organisationId,
      currentStage: filters.stage || undefined,
      jobId: filters.jobId || undefined,
    },
    include: {
      candidate: true,
      submittedApplication: { select: { id: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      notes: {
        include: {
          author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { actorUser: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const stageGroups = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN'].map((stage) => ({
    stage,
    count: applications.filter((application) => application.currentStage === stage).length,
  }));

  return {
    items: applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true })),
    stageGroups,
  };
}

const ATS_OPENING_STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER', 'HIRED', 'OFFER_DECLINED', 'REJECTED'];

// Lists the organisation's open positions ("openings") for the ATS board — both
// publicly posted (EXTERNAL/BOTH) and ATS-only (INTERNAL) jobs — each with a count
// of associated candidates per pipeline stage, so recruiters can see and manage the
// pipeline per opening rather than one flat stage list.
export async function getRecruiterAtsOpenings(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const jobs = await prisma.job.findMany({
    where: { organisationId: context.organisationId, status: { in: ['OPEN', 'ON_HOLD'] } },
    orderBy: { createdAt: 'desc' },
    include: { requisition: true },
  });

  const jobIds = jobs.map((job) => job.id);
  const grouped = jobIds.length
    ? await prisma.application.groupBy({
      by: ['jobId', 'currentStage'],
      where: { jobId: { in: jobIds }, organisationId: context.organisationId },
      _count: { _all: true },
    })
    : [];

  const stageByJob = new Map();
  for (const row of grouped) {
    if (!stageByJob.has(row.jobId)) stageByJob.set(row.jobId, {});
    stageByJob.get(row.jobId)[row.currentStage] = row._count._all;
  }

  return jobs.map((job) => {
    const stageCounts = stageByJob.get(job.id) || {};
    const totalCandidates = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);
    return {
      id: job.id,
      title: job.title,
      location: job.location || null,
      department: job.department || null,
      employmentType: job.employmentType || null,
      workplaceType: job.workplaceType || null,
      visibility: job.visibility,
      atsOnly: job.visibility === 'INTERNAL',
      numberOfOpenings: job.numberOfOpenings || 1,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      hiringManagerName: job.hiringManagerName || null,
      hiringManagerEmail: job.hiringManagerEmail || null,
      interviewRounds: Array.isArray(job.interviewPlanTemplate) ? job.interviewPlanTemplate : [],
      status: job.status,
      requisitionCode: job.requisition?.referenceNumber || null,
      createdAt: job.createdAt,
      totalCandidates,
      stageCounts: Object.fromEntries(ATS_OPENING_STAGES.map((stage) => [stage, stageCounts[stage] || 0])),
    };
  });
}

// Creates an ATS-only opening: an INTERNAL, OPEN job that is not published to the
// public board but can receive candidates from the resume databank. Only a title is
// required; the rest are optional details so recruiters can spin one up quickly.
export async function createAtsOpening(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const title = String(payload.title || '').trim();
  if (title.length < 2) {
    const error = new Error('An opening title is required.');
    error.statusCode = 422;
    throw error;
  }

  const slugBase = slugify(title, { lower: true, strict: true }) || 'opening';
  const slug = `${slugBase}-${crypto.randomBytes(4).toString('hex')}`;

  const job = await prisma.job.create({
    data: {
      organisationId: context.organisationId,
      recruiterId: actorUser.id,
      slug,
      title,
      description: String(payload.description || title).slice(0, 5000),
      skillsRequired: Array.isArray(payload.skillsRequired) ? payload.skillsRequired.slice(0, 50) : [],
      experienceMin: Number.isFinite(Number(payload.experienceMin)) ? Number(payload.experienceMin) : 0,
      experienceMax: Number.isFinite(Number(payload.experienceMax)) ? Number(payload.experienceMax) : 0,
      location: String(payload.location || 'Not specified').slice(0, 200),
      department: payload.department ? String(payload.department).slice(0, 120) : null,
      employmentType: payload.employmentType || 'FULL_TIME',
      workplaceType: payload.workplaceType || null,
      numberOfOpenings: Number.isFinite(Number(payload.numberOfOpenings)) ? Math.max(1, Number(payload.numberOfOpenings)) : 1,
      salaryMin: Number.isFinite(Number(payload.salaryMin)) && String(payload.salaryMin).trim() !== '' ? Math.max(0, Math.trunc(Number(payload.salaryMin))) : null,
      salaryMax: Number.isFinite(Number(payload.salaryMax)) && String(payload.salaryMax).trim() !== '' ? Math.max(0, Math.trunc(Number(payload.salaryMax))) : null,
      hiringManagerName: payload.hiringManagerName ? String(payload.hiringManagerName).trim().slice(0, 200) || null : null,
      hiringManagerEmail: payload.hiringManagerEmail ? String(payload.hiringManagerEmail).trim().toLowerCase().slice(0, 200) || null : null,
      interviewPlanTemplate: Array.isArray(payload.interviewRounds) && payload.interviewRounds.length
        ? payload.interviewRounds.slice(0, 6).map((r, i) => ({
          roundName: String(r?.roundName || `Round ${i + 1}`).slice(0, 120),
          interviewType: String(r?.interviewType || 'TECHNICAL').slice(0, 40),
          assessmentTemplateId: r?.assessmentTemplateId || null,
        }))
        : null,
      visibility: 'INTERNAL',
      isPublic: false,
      publicSalaryEnabled: false,
      status: 'OPEN',
    },
    include: { requisition: true },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'ats.opening.create',
    entityType: 'Job',
    entityId: job.id,
    metadata: { title: job.title, visibility: job.visibility },
    ...requestMeta,
  });

  return {
    id: job.id,
    title: job.title,
    location: job.location,
    department: job.department,
    employmentType: job.employmentType,
    visibility: job.visibility,
    atsOnly: true,
    numberOfOpenings: job.numberOfOpenings,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    hiringManagerName: job.hiringManagerName || null,
    hiringManagerEmail: job.hiringManagerEmail || null,
    interviewRounds: Array.isArray(job.interviewPlanTemplate) ? job.interviewPlanTemplate : [],
    status: job.status,
    totalCandidates: 0,
    stageCounts: Object.fromEntries(ATS_OPENING_STAGES.map((stage) => [stage, 0])),
  };
}

// Builds the email a candidate receives for an invite (Naukri NVite style): the
// recruiter's note, the full job details, and an Apply link to the public job
// page where they can formally apply.
function buildInviteEmailBody(message, job, applyUrl) {
  const lines = [
    message.trim(),
    '',
    'You are receiving this because a recruiter considers your profile suitable for this role and would like you to apply.',
    '',
    applyUrl ? `Apply here: ${applyUrl}` : '',
    '',
    '=== Job details ===',
    `Role: ${job.title}`,
  ];
  if (job.department) lines.push(`Department: ${job.department}`);
  if (job.employmentType) lines.push(`Employment type: ${String(job.employmentType).replaceAll('_', ' ')}`);
  if (job.workplaceType) lines.push(`Work mode: ${String(job.workplaceType).replaceAll('_', ' ')}`);
  if (job.location && job.location !== 'Not specified') lines.push(`Location: ${job.location}`);
  if (job.experienceMin != null || job.experienceMax != null) {
    lines.push(`Experience: ${job.experienceMin ?? 0}-${job.experienceMax ?? 0} yrs`);
  }
  if (!job.publicSalaryEnabled) {
    // hidden — do not show
  } else if (job.salaryMin || job.salaryMax) {
    const min = job.salaryMin ? `₹${Number(job.salaryMin).toLocaleString('en-IN')}` : '';
    const max = job.salaryMax ? `₹${Number(job.salaryMax).toLocaleString('en-IN')}` : '';
    lines.push(`Salary: ${[min, max].filter(Boolean).join(' - ')}`);
  }
  if (Array.isArray(job.skillsRequired) && job.skillsRequired.length) {
    lines.push(`Key skills: ${job.skillsRequired.slice(0, 20).join(', ')}`);
  }
  if (job.isWalkIn) {
    lines.push('', '=== Walk-in ===');
    if (job.walkInStartDate) lines.push(`Date: ${new Date(job.walkInStartDate).toDateString()}${job.walkInEndDate ? ` - ${new Date(job.walkInEndDate).toDateString()}` : ''}`);
    if (job.walkInTiming) lines.push(`Timing: ${job.walkInTiming}`);
    if (job.walkInVenueAddress) lines.push(`Venue: ${job.walkInVenueAddress}`);
    if (job.walkInContactName || job.walkInContactPhone) lines.push(`Contact: ${[job.walkInContactName, job.walkInContactPhone].filter(Boolean).join(' - ')}`);
    if (job.walkInGoogleMapsUrl) lines.push(`Map: ${job.walkInGoogleMapsUrl}`);
  }
  if (job.description) {
    lines.push('', '=== Description ===', String(job.description).slice(0, 4000));
  }
  if (applyUrl) lines.push('', `Apply now: ${applyUrl}`);
  return lines.filter((line) => line !== undefined).join('\n');
}

// Creates a candidate invite (Naukri NVite equivalent): resolves or creates the
// target opening, associates every selected candidate to it (APPLIED) so they
// surface as responses under that opening, emails each candidate the role, and
// records one CandidateInvite row tracking the send.
export async function createCandidateInvite(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const responseRecipients = Array.isArray(payload.responseRecipients)
    ? [...new Set(payload.responseRecipients.map((email) => String(email).trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    : [];

  let job;
  if (payload.mode === 'existing') {
    job = await prisma.job.findFirst({ where: { id: payload.jobId, organisationId: context.organisationId } });
    if (!job) {
      const error = new Error('Opening not found.');
      error.statusCode = 404;
      throw error;
    }
  } else {
    const title = String(payload.title || '').trim();
    if (title.length < 2) {
      const error = new Error('Give the new opening a title.');
      error.statusCode = 422;
      throw error;
    }
    const toInt = (v) => (Number.isFinite(Number(v)) && String(v ?? '').trim() !== '' ? Math.max(0, Math.trunc(Number(v))) : null);
    const canonicalLocations = Array.isArray(payload.locations) ? payload.locations : [];
    const locationString = String(payload.location || '').trim()
      || canonicalLocations.map((l) => l?.name || l?.id).filter(Boolean).join(', ')
      || 'Not specified';
    // Post a real, public opening (Naukri "posted job" equivalent) so the invite
    // email can carry an Apply link to the public job page. createJob handles
    // publish activation, receiving-email and (when enforced) credit checks.
    const created = await createJob(actorUser, {
      title,
      description: String(payload.description || title).slice(0, 8000),
      skillsRequired: Array.isArray(payload.skillsRequired) ? payload.skillsRequired.slice(0, 50) : [],
      experienceMin: Number.isFinite(Number(payload.experienceMin)) ? Number(payload.experienceMin) : 0,
      experienceMax: Number.isFinite(Number(payload.experienceMax)) ? Number(payload.experienceMax) : 0,
      salaryMin: toInt(payload.salaryMin),
      salaryMax: toInt(payload.salaryMax),
      publicSalaryEnabled: !payload.hideSalary,
      location: locationString.slice(0, 200),
      locations: canonicalLocations,
      department: payload.department ? String(payload.department).slice(0, 120) : null,
      employmentType: payload.employmentType || 'FULL_TIME',
      workplaceType: payload.workplaceType || null,
      numberOfOpenings: Number.isFinite(Number(payload.numberOfOpenings)) ? Math.max(1, Number(payload.numberOfOpenings)) : 1,
      isWalkIn: Boolean(payload.isWalkIn),
      walkInStartDate: payload.walkInStartDate || null,
      walkInEndDate: payload.walkInEndDate || null,
      walkInTiming: payload.walkInTiming || null,
      walkInContactName: payload.walkInContactName || null,
      walkInContactPhone: payload.walkInContactPhone || null,
      walkInVenueAddress: payload.walkInVenueAddress || null,
      walkInGoogleMapsUrl: payload.walkInGoogleMapsUrl || null,
      // Receiving email defaults to the recruiter, who gets the "new response"
      // notifications. Arbitrary extra recipients must be org-linked members, so
      // they are only recorded on the invite (not forced onto the job here).
      status: 'OPEN',
    }, context.organisationId, requestMeta);

    // Attach screening questions (best-effort — a malformed one is skipped, not fatal).
    for (const q of Array.isArray(payload.screeningQuestions) ? payload.screeningQuestions : []) {
      try {
        const type = q.questionType || 'SHORT_TEXT';
        const opts = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
        await addJobScreeningQuestion(actorUser, created.id, {
          questionText: q.questionText,
          questionType: type,
          required: Boolean(q.required),
          ...(['SINGLE_SELECT', 'MULTI_SELECT'].includes(type) && opts.length >= 2
            ? { config: { options: opts.map((o) => ({ label: o, value: o })) } }
            : {}),
        }, context.organisationId, requestMeta);
      } catch {
        // Skip an invalid question rather than failing the whole invite.
      }
    }

    // Reload the raw Job for association + email (needs skillsRequired, slug, etc.).
    job = await prisma.job.findUnique({ where: { id: created.id } });
  }

  const applyUrl = job.slug ? `${env.frontendUrl.replace(/\/$/, '')}/jobs/${job.slug}` : null;

  const items = [];
  let sentCount = 0;
  let skippedCount = 0;

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      const result = await prisma.$transaction((tx) => buildResumeWorkflowApplication(tx, {
        organisationId: context.organisationId,
        actorUser,
        candidate,
        job,
        stage: 'APPLIED',
        requestMeta,
      }));

      const recipientEmail = candidate.user?.email || candidate.email;
      let emailed = false;
      if (recipientEmail) {
        try {
          await sendRecruiterOutreachEmail(recipientEmail, payload.subject, buildInviteEmailBody(payload.message, job, applyUrl));
          emailed = true;
          sentCount += 1;
        } catch (emailError) {
          skippedCount += 1;
        }
      } else {
        skippedCount += 1;
      }

      items.push({
        candidateId,
        associated: !result.duplicate,
        duplicate: result.duplicate,
        emailed,
        success: true,
      });
    } catch (error) {
      skippedCount += 1;
      items.push({ candidateId, success: false, emailed: false, error: error.message });
    }
  }

  const invite = await prisma.candidateInvite.create({
    data: {
      organisationId: context.organisationId,
      jobId: job.id,
      createdByUserId: actorUser.id,
      subject: payload.subject,
      message: payload.message,
      channel: 'EMAIL',
      recipientEmails: responseRecipients,
      candidateCount: payload.candidateIds.length,
      sentCount,
      skippedCount,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'ats.invite.create',
    entityType: 'CandidateInvite',
    entityId: invite.id,
    metadata: { jobId: job.id, mode: payload.mode, candidateCount: payload.candidateIds.length, sentCount, skippedCount },
    ...requestMeta,
  });

  return {
    invite: { id: invite.id, candidateCount: invite.candidateCount, sentCount, skippedCount },
    job: { id: job.id, title: job.title, slug: job.slug, applyUrl },
    items,
  };
}

export async function getApplicationDetail(actorUser, applicationId, organisationId = null) {
  const { application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  return serializeApplication(application, {
    includeCoverLetter: true,
    includeCandidatePrivate: true,
  });
}

export async function updatePipelineStage(applicationId, actorUser, stage, organisationId = null, requestMeta = {}) {
  const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  if (!writableRoles.includes(context.activeMembership.role)) {
    const error = new Error('You are not allowed to update this application stage.');
    error.statusCode = 403;
    throw error;
  }

  ensureTransitionAllowed(application.currentStage, stage);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      statusLabel: stageLabelMap[stage],
    },
    include: {
      candidate: { include: { user: true, resumeBuilder: true } },
      job: { include: { requisition: true, recruiter: true, hiringManager: true } },
      submittedApplication: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      notes: {
        include: { author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } } },
        orderBy: { createdAt: 'desc' },
      },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'STAGE_CHANGED',
      message: `Moved to ${stageLabelMap[stage]}.`,
      metadata: { fromStage: application.currentStage, toStage: stage },
    }),
    createCandidateTimeline(
      application.submittedApplication?.id || application.id,
      context.organisationId,
      actorUser.id,
      stage,
      `${candidateVisibleStatusMap[stage]} for ${updated.job.title}.`,
      { fromStage: application.currentStage, toStage: stage },
    ),
    createNotification({
      organisationId: context.organisationId,
      recipientUserId: updated.job.recruiterId,
      type: 'APPLICATION',
      title: 'Application stage updated',
      message: `${updated.candidate.fullName} moved to ${stageLabelMap[stage]} for ${updated.job.title}.`,
      entityType: 'Application',
      entityId: applicationId,
    }),
    createCandidateNotification(updated, candidateVisibleStatusMap[stage], `${candidateVisibleStatusMap[stage]} for ${updated.job.title}.`),
    // Candidates sourced from the resume databank have no linked user account, so
    // only email when there is a real inbox to notify.
    updated.candidate?.user?.email
      ? sendPipelineEmail(updated.candidate.user.email, stage, updated.job.title)
      : Promise.resolve(),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.stage.update',
      entityType: 'Application',
      entityId: applicationId,
      beforeData: { currentStage: application.currentStage, statusLabel: application.statusLabel },
      afterData: { currentStage: updated.currentStage, statusLabel: updated.statusLabel },
      ...requestMeta,
    }),
  ]);

  // Manual offer outcome: keep the newest Offer record in sync with the pipeline
  // decision (recruiter marks it), so the offer status card reflects it. No
  // candidate email is sent for either outcome.
  if (stage === 'HIRED' || stage === 'OFFER_DECLINED') {
    const latestOffer = await prisma.offer.findFirst({
      where: { applicationId, status: { notIn: ['WITHDRAWN', 'SUPERSEDED'] } },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (latestOffer) {
      await prisma.offer.update({
        where: { id: latestOffer.id },
        data: stage === 'HIRED'
          ? { status: 'ACCEPTED', acceptedAt: new Date() }
          : { status: 'REJECTED', rejectedAt: new Date() },
      });
    }
  }

  // Moving a candidate to Rejected sends them the same polite rejection email
  // (recruiter CC'd) as an interview REJECT decision — only on the transition in.
  if (stage === 'REJECTED' && application.currentStage !== 'REJECTED') {
    await sendCandidateRejectionEmail({
      candidateName: updated.candidate?.fullName,
      candidateEmail: updated.candidate?.user?.email || updated.candidate?.email || null,
      jobTitle: updated.job?.title,
      recruiterName: updated.job?.recruiter?.fullName,
      recruiterEmail: updated.job?.recruiter?.email || null,
    });
  }

  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function scheduleInterview(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const normalizedPanelMembers = (payload.panelMembers || payload.panelUserIds || []).map((member, index) => (
    typeof member === 'string'
      ? {
          userId: member,
          isLead: index === 0,
          isObserver: false,
          feedbackRequired: true,
        }
      : {
          userId: String(member.userId || '').trim(),
          isLead: Boolean(member.isLead),
          isObserver: Boolean(member.isObserver),
          feedbackRequired: member.feedbackRequired !== false,
      }
  ));

  const runLegacyScheduling = async () => {
    const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
    const round = (application.interviewProcesses || [])
      .flatMap((process) => process.rounds || [])
      .find((item) => item.id === payload.roundId);

    if (!round) {
      const error = new Error('Interview round not found.');
      error.statusCode = 404;
      throw error;
    }

    const membershipUserIds = normalizedPanelMembers.map((item) => item.userId).filter(Boolean);
    const memberships = await prisma.organisationMembership.findMany({
      where: {
        organisationId: context.organisationId,
        userId: { in: membershipUserIds },
        status: 'ACTIVE',
      },
    });

    if (memberships.length !== membershipUserIds.length) {
      const error = new Error('Interview panel members must belong to the organisation.');
      error.statusCode = 422;
      throw error;
    }

    await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'SCHEDULED',
        interviewType: payload.interviewType,
        scheduledStartAt: new Date(payload.scheduledStartAt),
        scheduledEndAt: new Date(payload.scheduledEndAt),
        timezone: payload.timezone || round.timezone || 'UTC',
        meetingMode: payload.meetingMode || round.meetingMode || 'VIRTUAL',
        meetingLocation: payload.meetingLocation || null,
        meetingLink: payload.meetingLink || null,
        officeAddress: payload.officeAddress || null,
        candidateInstructions: payload.candidateInstructions || null,
        instructions: payload.notes || null,
        durationMinutes: payload.durationMinutes || round.durationMinutes || 60,
        rescheduleCount: round.rescheduleCount || 0,
      },
    });

    await prisma.application.update({
      where: { id: application.id },
      data: {
        currentStage: 'INTERVIEW_SCHEDULED',
        statusLabel: stageLabelMap.INTERVIEW_SCHEDULED,
      },
    });

    await Promise.all([
      createActivity(context.organisationId, applicationId, {
        actorUserId: actorUser.id,
        eventType: 'INTERVIEW_SCHEDULED',
        message: `${round.roundName} interview scheduled.`,
        metadata: { roundId: round.id },
      }),
      ...normalizedPanelMembers.map((member) => createNotification({
        organisationId: context.organisationId,
        recipientUserId: member.userId,
        type: 'INTERVIEW',
        title: 'Interview scheduled',
        message: `${round.roundName} has been scheduled.`,
        entityType: 'InterviewRound',
        entityId: round.id,
        metadata: { applicationId, roundId: round.id },
      })),
      recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'application.interview.schedule',
        entityType: 'InterviewRound',
        entityId: round.id,
        afterData: {
          scheduledStartAt: payload.scheduledStartAt,
          scheduledEndAt: payload.scheduledEndAt,
          panelUserIds: membershipUserIds,
        },
        ...requestMeta,
      }),
    ]);

    const updatedLegacy = await getApplicationWithRelations(context.organisationId, applicationId);
    return serializeApplication(updatedLegacy, { includeCoverLetter: true, includeCandidatePrivate: true });
  };

  if (!prisma.interviewMeeting?.create) {
    return runLegacyScheduling();
  }

  try {
    await scheduleInterviewMeeting(applicationId, actorUser, {
      ...payload,
      panelMembers: normalizedPanelMembers,
      notes: payload.notes || null,
    }, organisationId, requestMeta);
  } catch (error) {
    if (!isMissingInterviewMeetingInfrastructure(error)) {
      throw error;
    }
    return runLegacyScheduling();
  }

  const context = await requireOrganisationContext(actorUser, organisationId);
  const updated = await getApplicationWithRelations(context.organisationId, applicationId);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function cancelInterview(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const runLegacyCancellation = async () => {
    const { context, application } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
    const round = (application.interviewProcesses || [])
      .flatMap((process) => process.rounds || [])
      .find((item) => item.id === payload.roundId);

    if (!round) {
      const error = new Error('Interview round not found.');
      error.statusCode = 404;
      throw error;
    }

    await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'CANCELLED',
        cancelReason: payload.cancelReason,
      },
    });

    await Promise.all([
      createActivity(context.organisationId, applicationId, {
        actorUserId: actorUser.id,
        eventType: 'INTERVIEW_CANCELLED',
        message: `${round.roundName} interview cancelled.`,
        metadata: { roundId: round.id, cancelReason: payload.cancelReason },
      }),
      recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'application.interview.cancel',
        entityType: 'InterviewRound',
        entityId: round.id,
        afterData: { cancelReason: payload.cancelReason },
        ...requestMeta,
      }),
    ]);

    const updatedLegacy = await getApplicationWithRelations(context.organisationId, applicationId);
    return serializeApplication(updatedLegacy, { includeCoverLetter: true, includeCandidatePrivate: true });
  };

  if (!prisma.interviewMeeting?.update) {
    return runLegacyCancellation();
  }

  try {
    await cancelInterviewMeeting(applicationId, actorUser, payload, organisationId, requestMeta);
  } catch (error) {
    const canFallbackToLegacy = isMissingInterviewMeetingInfrastructure(error)
      || (error?.statusCode === 422 && error?.message === 'This interview has not been scheduled yet.');

    if (!canFallbackToLegacy) {
      throw error;
    }

    return runLegacyCancellation();
  }

  const context = await requireOrganisationContext(actorUser, organisationId);
  const updated = await getApplicationWithRelations(context.organisationId, applicationId);
  return serializeApplication(updated, { includeCoverLetter: true, includeCandidatePrivate: true });
}

export async function addAtsNote(applicationId, actorUser, content, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.create({
    data: {
      organisationId: context.organisationId,
      applicationId,
      authorId: actorUser.id,
      content,
    },
    include: {
      author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_ADDED',
      message: 'Recruiter note added.',
      metadata: { noteId: note.id },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.create',
      entityType: 'AtsNote',
      entityId: note.id,
      afterData: note,
      ...requestMeta,
    }),
  ]);

  return serializeAtsNote(note);
}

export async function updateAtsNote(applicationId, noteId, actorUser, content, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.findFirst({
    where: { id: noteId, applicationId, organisationId: context.organisationId },
    include: { author: true },
  });

  if (!note) {
    const error = new Error('Note not found.');
    error.statusCode = 404;
    throw error;
  }

  if (note.authorId !== actorUser.id) {
    const error = new Error('You can edit only your own notes.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.atsNote.update({
    where: { id: noteId },
    data: { content },
    include: {
      author: { include: { recruiterProfile: { include: { organisation: true } }, candidateProfile: true } },
    },
  });

  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_UPDATED',
      message: 'Recruiter note updated.',
      metadata: { noteId },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.update',
      entityType: 'AtsNote',
      entityId: noteId,
      beforeData: note,
      afterData: updated,
      ...requestMeta,
    }),
  ]);

  return serializeAtsNote(updated);
}

export async function deleteAtsNote(applicationId, noteId, actorUser, organisationId = null, requestMeta = {}) {
  const { context } = await assertOrganisationCanAccessApplication(actorUser, applicationId, organisationId);
  const note = await prisma.atsNote.findFirst({
    where: { id: noteId, applicationId, organisationId: context.organisationId },
  });

  if (!note) {
    const error = new Error('Note not found.');
    error.statusCode = 404;
    throw error;
  }

  if (note.authorId !== actorUser.id) {
    const error = new Error('You can delete only your own notes.');
    error.statusCode = 403;
    throw error;
  }

  await prisma.atsNote.delete({ where: { id: noteId } });
  await Promise.all([
    createActivity(context.organisationId, applicationId, {
      actorUserId: actorUser.id,
      eventType: 'NOTE_DELETED',
      message: 'Recruiter note deleted.',
      metadata: { noteId },
    }),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'application.note.delete',
      entityType: 'AtsNote',
      entityId: noteId,
      beforeData: note,
      ...requestMeta,
    }),
  ]);

  return { deleted: true };
}

export async function getCandidateApplications(candidateId) {
  const applications = await prisma.application.findMany({
    where: { candidateId },
    include: {
      job: { include: { recruiter: { include: { recruiterProfile: { include: { organisation: true } } } }, requisition: true } },
      candidate: true,
      activities: { include: { actorUser: true }, orderBy: { createdAt: 'desc' } },
      interviewProcesses: {
        include: {
          createdBy: true,
          rounds: {
            include: {
              panelMembers: { include: { user: true } },
              feedbacks: { include: { interviewer: true } },
            },
          },
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  });

  // Candidate-facing (GET /api/ats/applications is CANDIDATE-only): publicJob
  // ensures a hidden salary never leaks through the embedded job.
  return applications.map((application) => serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true, publicJob: true }));
}

export async function addCandidatesToAts(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = await ensureRequirementJob(context, payload.jobId, payload.requisitionId || null);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      const result = await prisma.$transaction((tx) => buildResumeWorkflowApplication(tx, {
        organisationId: context.organisationId,
        actorUser,
        candidate,
        job,
        stage: 'APPLIED',
        requestMeta,
      }));

      items.push({
        candidateId,
        success: !result.duplicate,
        duplicate: result.duplicate,
        application: serializeApplication(result.application, { includeCoverLetter: true, includeCandidatePrivate: true }),
      });

      if (!result.duplicate && job.recruiterId && job.recruiterId !== actorUser.id) {
        await createNotification({
          organisationId: context.organisationId,
          recipientUserId: job.recruiterId,
          type: 'APPLICATION',
          title: 'Candidate added to ATS',
          message: `${candidate.fullName} was added to ${job.title} from the resume database.`,
          entityType: 'Application',
          entityId: result.application.id,
        });
      }
    } catch (error) {
      items.push({
        candidateId,
        success: false,
        duplicate: false,
        error: error.message,
      });
    }
  }

  return {
    job: { id: job.id, title: job.title, requisitionId: job.requisitionId || null },
    items,
  };
}

export async function shortlistCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = await ensureRequirementJob(context, payload.jobId, payload.requisitionId || null);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      const existing = await prisma.application.findUnique({
        where: {
          jobId_candidateId: {
            jobId: job.id,
            candidateId,
          },
        },
      });

      if (!existing) {
        const created = await prisma.$transaction((tx) => buildResumeWorkflowApplication(tx, {
          organisationId: context.organisationId,
          actorUser,
          candidate,
          job,
          stage: 'SHORTLISTED',
          requestMeta,
        }));
        items.push({
          candidateId,
          success: true,
          duplicate: false,
          application: serializeApplication(created.application, { includeCoverLetter: true, includeCandidatePrivate: true }),
        });
        if (job.recruiterId && job.recruiterId !== actorUser.id) {
          await createNotification({
            organisationId: context.organisationId,
            recipientUserId: job.recruiterId,
            type: 'APPLICATION',
            title: 'Candidate shortlisted',
            message: `${candidate.fullName} was shortlisted for ${job.title} from the resume database.`,
            entityType: 'Application',
            entityId: created.application.id,
          });
        }
        continue;
      }

      if (existing.currentStage === 'SHORTLISTED') {
        const current = await getApplicationDetail(actorUser, existing.id, context.organisationId);
        items.push({
          candidateId,
          success: false,
          duplicate: true,
          application: current,
        });
        continue;
      }

      const updated = await updatePipelineStage(existing.id, actorUser, 'SHORTLISTED', context.organisationId, requestMeta);
      items.push({
        candidateId,
        success: true,
        duplicate: false,
        application: updated,
      });
      if (job.recruiterId && job.recruiterId !== actorUser.id) {
        await createNotification({
          organisationId: context.organisationId,
          recipientUserId: job.recruiterId,
          type: 'APPLICATION',
          title: 'Candidate shortlisted',
          message: `${candidate.fullName} was shortlisted for ${job.title}.`,
          entityType: 'Application',
          entityId: updated.id,
        });
      }
    } catch (error) {
      items.push({
        candidateId,
        success: false,
        duplicate: false,
        error: error.message,
      });
    }
  }

  return {
    job: { id: job.id, title: job.title, requisitionId: job.requisitionId || null },
    items,
  };
}

export async function tagCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      await ensureResumeCandidate(candidateId);
      const savedCandidate = await prisma.savedCandidate.upsert({
        where: {
          recruiterId_candidateId: {
            recruiterId: actorUser.recruiterProfile.id,
            candidateId,
          },
        },
        update: {
          organisationId: context.organisationId,
          tag: payload.tag,
        },
        create: {
          organisationId: context.organisationId,
          recruiterId: actorUser.recruiterProfile.id,
          candidateId,
          tag: payload.tag,
        },
      });

      await recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'resume-search.tag',
        entityType: 'SavedCandidate',
        entityId: savedCandidate.id,
        afterData: { tag: payload.tag, candidateId },
        ...requestMeta,
      });

      items.push({ candidateId, success: true, tag: payload.tag });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return { items };
}

export async function emailCandidatesFromResumeSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await getWritableOrganisationContext(actorUser, organisationId);
  const job = payload.jobId ? await ensureRequirementJob(context, payload.jobId, null) : null;
  const items = [];

  for (const candidateId of payload.candidateIds) {
    try {
      const candidate = await ensureResumeCandidate(candidateId);
      // Portal applicants carry email on their linked user; databank-imported
      // candidates (no user account) carry it on the profile itself.
      const recipientEmail = candidate.user?.email || candidate.email;
      if (!recipientEmail) {
        items.push({ candidateId, success: false, error: 'Candidate email unavailable.' });
        continue;
      }

      const body = job
        ? `${payload.body}\n\nContext: ${job.title}`
        : payload.body;
      await sendRecruiterOutreachEmail(recipientEmail, payload.subject, body);
      await recordAuditLog({
        organisationId: context.organisationId,
        actorUserId: actorUser.id,
        action: 'resume-search.email',
        entityType: 'CandidateProfile',
        entityId: candidateId,
        metadata: {
          jobId: job?.id || null,
          subject: payload.subject,
        },
        ...requestMeta,
      });
      items.push({ candidateId, success: true });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return {
    job: job ? { id: job.id, title: job.title } : null,
    items,
  };
}
