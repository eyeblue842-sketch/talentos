import { prisma } from '../../config/db.js';
import { analyticsMetricVersion } from '../policies/intelligencePolicy.js';

function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return Math.round(sorted[mid]);
}

function diffDays(start, end) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function inRange(dateValue, since) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return !Number.isNaN(date.getTime()) && date >= since;
}

export async function getOrganisationAnalyticsMetrics(organisationId, filters = {}) {
  const periodDays = filters.periodDays || 30;
  const since = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000));

  const [jobs, applications, interviews, offers, memberships] = await Promise.all([
    prisma.job.findMany({
      where: {
        organisationId,
        ...(filters.recruiterId ? { recruiterId: filters.recruiterId } : {}),
        ...(filters.department ? { department: filters.department } : {}),
        ...(filters.businessUnit ? { businessUnit: filters.businessUnit } : {}),
        ...(filters.location ? { location: filters.location } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        recruiterId: true,
        department: true,
        businessUnit: true,
        location: true,
        createdAt: true,
        applicationDeadline: true,
      },
    }),
    prisma.application.findMany({
      where: { organisationId },
      select: {
        id: true,
        jobId: true,
        currentStage: true,
        appliedAt: true,
        updatedAt: true,
        recruiterTag: true,
      },
    }),
    prisma.interviewRound.findMany({
      where: { organisationId },
      select: {
        id: true,
        interviewProcessId: true,
        status: true,
        scheduledStartAt: true,
        createdAt: true,
      },
    }),
    prisma.offer.findMany({
      where: { organisationId },
      select: {
        id: true,
        applicationId: true,
        status: true,
        createdAt: true,
        releasedAt: true,
        acceptedAt: true,
        actualJoiningDate: true,
      },
    }),
    prisma.organisationMembership.findMany({
      where: {
        organisationId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'] },
      },
      select: {
        userId: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  const periodApplications = applications.filter((item) => inRange(item.appliedAt, since));
  const periodInterviews = interviews.filter((item) => inRange(item.createdAt, since));
  const periodOffers = offers.filter((item) => inRange(item.createdAt, since) || inRange(item.releasedAt, since));

  const funnel = [
    { stage: 'APPLIED', count: applications.filter((item) => item.currentStage === 'APPLIED').length },
    { stage: 'SHORTLISTED', count: applications.filter((item) => item.currentStage === 'SHORTLISTED').length },
    { stage: 'INTERVIEW_SCHEDULED', count: applications.filter((item) => item.currentStage === 'INTERVIEW_SCHEDULED').length },
    { stage: 'SELECTED', count: applications.filter((item) => item.currentStage === 'SELECTED').length },
    { stage: 'REJECTED', count: applications.filter((item) => item.currentStage === 'REJECTED').length },
    { stage: 'WITHDRAWN', count: applications.filter((item) => item.currentStage === 'WITHDRAWN').length },
  ];

  const releasedOffers = offers.filter((item) => ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'DEFERRED', 'NO_SHOW'].includes(item.status));
  const acceptedOffers = offers.filter((item) => ['ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'DEFERRED', 'NO_SHOW'].includes(item.status));
  const joinedOffers = offers.filter((item) => item.status === 'JOINED');
  const applicationsToInterview = applications.filter((item) => item.currentStage === 'INTERVIEW_SCHEDULED' || item.currentStage === 'SELECTED').length;
  const interviewToOffer = periodInterviews.length ? Number(((releasedOffers.length / periodInterviews.length) * 100).toFixed(1)) : 0;
  const applicationToInterview = periodApplications.length ? Number(((applicationsToInterview / periodApplications.length) * 100).toFixed(1)) : 0;
  const offerAcceptanceRate = releasedOffers.length ? Number(((acceptedOffers.length / releasedOffers.length) * 100).toFixed(1)) : 0;
  const joiningRatio = acceptedOffers.length ? Number(((joinedOffers.length / acceptedOffers.length) * 100).toFixed(1)) : 0;

  const timeToOfferValues = offers.map((offer) => {
    const application = applications.find((item) => item.id === offer.applicationId);
    return diffDays(application?.appliedAt, offer.releasedAt);
  }).filter((value) => value != null);
  const timeToHireValues = offers.map((offer) => {
    const application = applications.find((item) => item.id === offer.applicationId);
    return diffDays(application?.appliedAt, offer.actualJoiningDate);
  }).filter((value) => value != null);

  const agingJobs = jobs.filter((job) => ['OPEN', 'ON_HOLD'].includes(job.status)).map((job) => ({
    id: job.id,
    title: job.title,
    ageDays: diffDays(job.createdAt, new Date()) || 0,
  })).sort((a, b) => b.ageDays - a.ageDays).slice(0, 10);

  const agingApplications = applications.map((item) => ({
    id: item.id,
    ageDays: diffDays(item.appliedAt, new Date()) || 0,
    currentStage: item.currentStage,
  })).sort((a, b) => b.ageDays - a.ageDays).slice(0, 10);

  const recruiterBreakdown = memberships.map((membership) => {
    const recruiterJobs = jobs.filter((job) => job.recruiterId === membership.userId);
    const recruiterApplications = applications.filter((application) => recruiterJobs.some((job) => job.id === application.jobId));
    return {
      recruiterId: membership.userId,
      activeJobs: recruiterJobs.filter((job) => ['OPEN', 'ON_HOLD'].includes(job.status)).length,
      applications: recruiterApplications.length,
      shortlisted: recruiterApplications.filter((item) => item.currentStage === 'SHORTLISTED').length,
      interviews: recruiterApplications.filter((item) => item.currentStage === 'INTERVIEW_SCHEDULED').length,
      selected: recruiterApplications.filter((item) => item.currentStage === 'SELECTED').length,
    };
  });

  return {
    version: analyticsMetricVersion,
    period: { days: periodDays, since: since.toISOString(), until: new Date().toISOString() },
    filters: {
      recruiterId: filters.recruiterId || null,
      department: filters.department || null,
      businessUnit: filters.businessUnit || null,
      location: filters.location || null,
    },
    sampleSize: {
      jobs: jobs.length,
      applications: applications.length,
      interviews: interviews.length,
      offers: offers.length,
      recruiters: memberships.length,
    },
    metrics: {
      activeJobs: jobs.filter((job) => ['OPEN', 'ON_HOLD'].includes(job.status)).length,
      draftJobs: jobs.filter((job) => job.status === 'DRAFT').length,
      applicationVolume: periodApplications.length,
      interviewVolume: periodInterviews.length,
      offerVolume: periodOffers.length,
      timeToOfferDaysMedian: median(timeToOfferValues),
      timeToHireDaysMedian: median(timeToHireValues),
      offerAcceptanceRate,
      interviewToOfferConversion: interviewToOffer,
      applicationToInterviewConversion: applicationToInterview,
      joiningRatio,
      hiringVelocity: joinedOffers.length,
      requisitionFulfilment: null,
    },
    funnel,
    recruiterBreakdown,
    sourceEffectiveness: [],
    aging: {
      jobs: agingJobs,
      applications: agingApplications,
    },
  };
}
