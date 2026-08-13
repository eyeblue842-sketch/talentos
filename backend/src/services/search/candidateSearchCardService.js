import { serializeCandidateSearchCard } from '../../serializers/index.js';
import { daysAgo, extractEducationEntries, extractExperienceEntries, iso } from './searchUtils.js';

export function getOwnOrganisationApplication(candidate, organisationId) {
  return (candidate.applications || []).find((application) => application.organisationId === organisationId) || null;
}

export function getGenericGlobalHiringActivity(candidate, organisationId) {
  const otherApplications = (candidate.applications || []).filter((application) => application.organisationId !== organisationId);
  if (!otherApplications.length) {
    if (candidate.lastActiveAt && new Date(candidate.lastActiveAt) >= daysAgo(30)) {
      return 'Recently Active';
    }
    return 'Available';
  }

  if (otherApplications.some((application) => application.currentStage === 'SELECTED')) {
    return 'Recently Joined';
  }
  if (otherApplications.some((application) => application.currentStage === 'INTERVIEW_SCHEDULED')) {
    return 'Interview Activity';
  }
  if (otherApplications.some((application) => application.currentStage === 'SHORTLISTED')) {
    return 'Shortlisted Elsewhere';
  }
  if (otherApplications.some((application) => application.currentStage === 'APPLIED')) {
    return 'Shortlisted Elsewhere';
  }

  return 'Recently Active';
}

export function formatOwnOrganisationAtsStatus(application) {
  if (!application) return 'Not in ATS';
  switch (application.currentStage) {
    case 'APPLIED':
      return 'Applied';
    case 'SHORTLISTED':
      return 'Shortlisted';
    case 'INTERVIEW_SCHEDULED':
      return 'Technical Interview';
    case 'SELECTED':
      return 'Joined';
    case 'REJECTED':
      return 'Rejected';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return application.statusLabel || 'In ATS';
  }
}

export function buildResumeSummary(candidate) {
  if (candidate.summary) return candidate.summary;
  const skills = (candidate.skills || []).slice(0, 4).join(', ');
  const title = candidate.currentTitle || candidate.headline || 'Candidate';
  const location = candidate.location || 'shared locations';
  return `${title} with ${candidate.totalExperience || 0} years of experience, based in ${location}, strongest around ${skills || 'core capabilities'}.`;
}

export function buildCandidateCard(candidate, organisationId) {
  const ownApplication = getOwnOrganisationApplication(candidate, organisationId);
  const organisationTags = [...new Set((candidate.savedByRecruiters || []).map((item) => item.tag).filter(Boolean))];
  const latestEducation = extractEducationEntries(candidate)[0];
  const currentRole = extractExperienceEntries(candidate).find((entry) => entry.isCurrent || entry.currentlyWorking)
    || extractExperienceEntries(candidate)[0];
  const previousRole = extractExperienceEntries(candidate).find((entry) => !(entry.isCurrent || entry.currentlyWorking));
  const canRevealCompensation = Boolean(ownApplication || organisationTags.length);

  return {
    ...serializeCandidateSearchCard({
      ...candidate,
      educationSummary: latestEducation?.degree
        ? `${latestEducation.degree}${latestEducation.school ? `, ${latestEducation.school}` : ''}`
        : undefined,
      savedByOrganisation: organisationTags.length > 0,
      organisationTags,
    }),
    currentCompany: candidate.currentEmployer || currentRole?.company || null,
    currentDesignation: candidate.currentDesignation || candidate.currentTitle || currentRole?.title || null,
    previousCompany: previousRole?.company || previousRole?.employer || null,
    previousDesignation: previousRole?.title || previousRole?.jobTitle || previousRole?.designation || null,
    summary: candidate.summary || null,
    profileImageUrl: candidate.profileImageUrl || null,
    educationDetail: latestEducation ? {
      degree: latestEducation.degree || latestEducation.course || null,
      institution: latestEducation.institution || latestEducation.school || null,
      completionYear: latestEducation.completionYear || latestEducation.endYear || null,
    } : null,
    resumeAvailable: Boolean(
      (candidate.latestResumeAsset?.kind === 'RESUME' && candidate.latestResumeAsset?.status === 'ACTIVE')
      || candidate.latestResumeAssetId
      || candidate.resumeUrl,
    ),
    noticePeriodDays: candidate.noticePeriodDays,
    currentSalary: canRevealCompensation ? candidate.currentCtcLpa : null,
    expectedSalary: canRevealCompensation ? candidate.expectedCtcLpa : null,
    salaryVisible: canRevealCompensation,
    preferredLocations: candidate.preferredLocations || [],
    preferredRoles: candidate.preferredRoles || [],
    employmentPreferences: candidate.employmentPreferences || [],
    workplacePreferences: candidate.workplacePreferences || [],
    willingToRelocate: candidate.willingToRelocate,
    workAuthorization: candidate.workAuthorization || null,
    keySkills: (candidate.skills || []).slice(0, 8),
    resumeUpdatedAt: iso(candidate.updatedAt),
    lastActiveAt: iso(candidate.lastActiveAt),
    matchScore: candidate.__relevanceScore || 0,
    globalHiringActivity: getGenericGlobalHiringActivity(candidate, organisationId),
    ownOrganisationAtsStatus: formatOwnOrganisationAtsStatus(ownApplication),
    organisationApplicationId: ownApplication?.id || null,
    resumeScore: candidate.resumeBuilder?.completedScore || null,
  };
}
