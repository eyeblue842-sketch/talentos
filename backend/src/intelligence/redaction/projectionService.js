import { dataClasses } from '../policies/intelligencePolicy.js';

function scrubText(value = '', maxLength = 4000) {
  return String(value || '')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value, maxItems = 20, maxLength = 120) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => scrubText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}

export function projectResumeForIntelligence(candidate, resumeAsset = null) {
  const experienceEntries = Array.isArray(candidate.experienceEntries) ? candidate.experienceEntries : [];
  const educationEntries = Array.isArray(candidate.educationEntries) ? candidate.educationEntries : [];
  const certificationEntries = Array.isArray(candidate.certificationEntries) ? candidate.certificationEntries : [];
  return {
    dataClass: dataClasses.CANDIDATE_PROFESSIONAL,
    candidateId: candidate.id,
    title: scrubText(candidate.currentTitle || candidate.headline, 160),
    summary: scrubText(candidate.summary, 2400),
    location: scrubText(candidate.location, 120),
    totalExperience: candidate.totalExperience ?? null,
    skills: cleanArray(candidate.skills, 40),
    primarySkills: cleanArray(candidate.primarySkills, 20),
    experienceEntries: experienceEntries.slice(0, 12).map((entry) => ({
      employer: scrubText(entry.employer || entry.company, 160),
      title: scrubText(entry.jobTitle || entry.title, 160),
      startDate: entry.startDate || null,
      endDate: entry.endDate || null,
      currentlyWorking: Boolean(entry.currentlyWorking),
      description: scrubText(entry.description || entry.summary, 500),
    })),
    educationEntries: educationEntries.slice(0, 8).map((entry) => ({
      institution: scrubText(entry.institution || entry.school, 160),
      degree: scrubText(entry.degree, 160),
      specialization: scrubText(entry.specialization, 160),
      startYear: entry.startYear || null,
      endYear: entry.endYear || null,
    })),
    certifications: certificationEntries.slice(0, 15).map((entry) => scrubText(entry.name || entry.label, 160)),
    parsedText: scrubText(resumeAsset?.parsedText || '', 12000),
    parsedData: resumeAsset?.parsedData || null,
  };
}

export function projectJobForIntelligence(job, requisition = null, sourceDescription = '') {
  return {
    dataClass: dataClasses.PUBLIC_JOB_DATA,
    jobId: job?.id || null,
    requisitionId: requisition?.id || null,
    title: scrubText(job?.title || requisition?.title, 160),
    location: scrubText(job?.location || requisition?.location, 120),
    employmentType: job?.employmentType || requisition?.employmentType || null,
    workplaceType: job?.workplaceType || null,
    experienceMin: job?.experienceMin ?? null,
    experienceMax: job?.experienceMax ?? null,
    department: scrubText(job?.department || requisition?.department, 120),
    businessUnit: scrubText(job?.businessUnit || requisition?.businessUnit, 120),
    description: scrubText(sourceDescription || job?.description || requisition?.reasonForHiring, 10000),
    skillsRequired: cleanArray(job?.skillsRequired || [], 40),
    skillsPreferred: cleanArray(job?.skillsPreferred || [], 30),
    targetHires: job?.targetHires ?? requisition?.numberOfOpenings ?? null,
  };
}

export function projectInterviewContext(application, round = null, notes = '') {
  return {
    dataClass: dataClasses.ORGANIZATION_INTERNAL,
    applicationId: application.id,
    jobTitle: scrubText(application.job?.title, 160),
    candidateTitle: scrubText(application.candidate?.headline || application.candidate?.currentTitle, 160),
    candidateSummary: scrubText(application.candidate?.summary, 1500),
    candidateSkills: cleanArray(application.candidate?.skills || [], 30),
    roundName: scrubText(round?.roundName, 120),
    roundType: round?.interviewType || null,
    feedbackEvidence: Array.isArray(round?.feedbacks)
      ? round.feedbacks.slice(0, 8).map((feedback) => ({
          recommendation: feedback.recommendation || null,
          overallScore: feedback.overallScore ?? null,
          comments: scrubText(feedback.comments || feedback.detailedNotes, 800),
          strengths: scrubText(feedback.strengths, 500),
          weaknesses: scrubText(feedback.weaknesses, 500),
        }))
      : [],
    notes: scrubText(notes, 10000),
  };
}

export function projectAnalyticsForIntelligence(metricsPayload) {
  return {
    dataClass: dataClasses.ORGANIZATION_INTERNAL,
    period: metricsPayload.period,
    filters: metricsPayload.filters,
    sampleSize: metricsPayload.sampleSize,
    metrics: metricsPayload.metrics,
    funnel: metricsPayload.funnel,
    recruiterBreakdown: metricsPayload.recruiterBreakdown,
    sourceEffectiveness: metricsPayload.sourceEffectiveness,
    aging: metricsPayload.aging,
  };
}
