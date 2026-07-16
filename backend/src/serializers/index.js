function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeOrganisation(organisation) {
  if (!organisation) return null;
  return {
    id: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    status: organisation.status,
    website: organisation.website,
    logoUrl: organisation.logoUrl,
    createdAt: iso(organisation.createdAt),
    updatedAt: iso(organisation.updatedAt),
  };
}

export function serializeOrganisationMembership(membership) {
  if (!membership) return null;
  return {
    id: membership.id,
    organisationId: membership.organisationId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    createdAt: iso(membership.createdAt),
    updatedAt: iso(membership.updatedAt),
    organisation: serializeOrganisation(membership.organisation),
    user: membership.user
      ? {
          id: membership.user.id,
          email: membership.user.email,
          role: membership.user.role,
          isActive: membership.user.isActive,
        }
      : undefined,
  };
}

export function serializeRecruiterProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    organisationId: profile.organisationId,
    companyEmailDomain: profile.companyEmailDomain,
    companyName: profile.companyName,
    aboutCompany: profile.aboutCompany,
    industryDomain: profile.industryDomain,
    companyType: profile.companyType,
    headquartersLocation: profile.headquartersLocation,
    startedYear: profile.startedYear,
    employeeCount: profile.employeeCount,
    branchCount: profile.branchCount,
    officeLocations: profile.officeLocations,
    annualTurnover: profile.annualTurnover,
    designation: profile.designation,
    workingSince: profile.workingSince,
    companySize: profile.companySize,
    website: profile.website,
    profileCompleted: profile.profileCompleted,
    organisation: serializeOrganisation(profile.organisation),
  };
}

export function serializeCandidateProfile(profile, options = {}) {
  if (!profile) return null;
  const includePrivate = Boolean(options.includePrivate);
  return {
    id: profile.id,
    fullName: profile.fullName,
    headline: profile.headline,
    location: profile.location,
    preferredLocations: profile.preferredLocations,
    totalExperience: profile.totalExperience,
    availability: profile.availability,
    skills: profile.skills,
    summary: profile.summary,
    currentCtcLpa: includePrivate ? profile.currentCtcLpa : undefined,
    expectedCtcLpa: includePrivate ? profile.expectedCtcLpa : undefined,
    resumeUrl: includePrivate ? profile.resumeUrl : undefined,
    sharedResumeSlug: profile.sharedResumeSlug,
    profileViews: includePrivate ? profile.profileViews : undefined,
    lastActiveAt: iso(profile.lastActiveAt),
    updatedAt: iso(profile.updatedAt),
  };
}

export function serializeCandidateSearchCard(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    fullName: profile.fullName,
    headline: profile.headline,
    location: profile.location,
    totalExperience: profile.totalExperience,
    availability: profile.availability,
    skills: profile.skills,
    educationSummary: profile.educationSummary,
    resumeAvailable: Boolean(profile.resumeUrl || profile.resumeBuilder),
    savedByOrganisation: Boolean(profile.savedByOrganisation),
    organisationTags: profile.organisationTags || [],
    updatedAt: iso(profile.updatedAt),
  };
}

export function serializeCandidatePrivateDetail(profile) {
  if (!profile) return null;
  return {
    ...serializeCandidateProfile(profile, { includePrivate: true }),
    user: profile.user
      ? {
          id: profile.user.id,
          email: profile.user.email,
        }
      : undefined,
    resumeBuilder: profile.resumeBuilder
      ? serializeResumeBuilder(profile.resumeBuilder)
      : undefined,
  };
}

export function serializeUser(user, options = {}) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    recruiterProfile: serializeRecruiterProfile(user.recruiterProfile),
    candidateProfile: serializeCandidateProfile(user.candidateProfile, options),
    memberships: user.memberships?.map(serializeOrganisationMembership),
    activeMembership: serializeOrganisationMembership(options.activeMembership || user.activeMembership),
  };
}

export function serializePublicRecruiter(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    recruiterProfile: user.recruiterProfile
      ? {
          companyName: user.recruiterProfile.companyName,
          companyType: user.recruiterProfile.companyType,
          industryDomain: user.recruiterProfile.industryDomain,
          headquartersLocation: user.recruiterProfile.headquartersLocation,
          website: user.recruiterProfile.website,
        }
      : null,
    organisation: serializeOrganisation(user.recruiterProfile?.organisation),
  };
}

export function serializeJob(job, options = {}) {
  if (!job) return null;
  return {
    id: job.id,
    organisationId: job.organisationId,
    requisitionId: job.requisitionId,
    hiringManagerId: job.hiringManagerId,
    title: job.title,
    slug: job.slug,
    description: job.description,
    skillsRequired: job.skillsRequired,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    location: job.location,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    numberOfOpenings: job.numberOfOpenings,
    department: job.department,
    businessUnit: job.businessUnit,
    applicationDeadline: iso(job.applicationDeadline),
    status: job.status,
    archivedAt: iso(job.archivedAt),
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    applicationsCount: job._count?.applications,
    recruiter: options.publicRecruiter ? serializePublicRecruiter(job.recruiter) : job.recruiter
      ? { id: job.recruiter.id, email: job.recruiter.email }
      : undefined,
    hiringManager: job.hiringManager ? { id: job.hiringManager.id, email: job.hiringManager.email } : undefined,
    requisition: options.includeRequisition ? serializeJobRequisition(job.requisition) : undefined,
    pipelineSummary: options.pipelineSummary || undefined,
  };
}

export function serializeActivity(activity) {
  if (!activity) return null;
  return {
    id: activity.id,
    organisationId: activity.organisationId,
    applicationId: activity.applicationId,
    actorUserId: activity.actorUserId,
    eventType: activity.eventType,
    message: activity.message,
    metadata: activity.metadata,
    createdAt: iso(activity.createdAt),
    updatedAt: iso(activity.updatedAt),
    actor: activity.actorUser ? { id: activity.actorUser.id, email: activity.actorUser.email, role: activity.actorUser.role } : undefined,
  };
}

export function serializeAtsNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    organisationId: note.organisationId,
    applicationId: note.applicationId,
    authorId: note.authorId,
    content: note.content,
    createdAt: iso(note.createdAt),
    updatedAt: iso(note.updatedAt),
    author: note.author
      ? {
          id: note.author.id,
          email: note.author.email,
          role: note.author.role,
          candidateProfile: note.author.candidateProfile ? serializeCandidateProfile(note.author.candidateProfile) : undefined,
          recruiterProfile: note.author.recruiterProfile ? serializeRecruiterProfile(note.author.recruiterProfile) : undefined,
        }
      : undefined,
  };
}

export function serializeApplication(application, options = {}) {
  if (!application) return null;
  return {
    id: application.id,
    organisationId: application.organisationId,
    currentStage: application.currentStage,
    statusLabel: application.statusLabel,
    coverLetter: options.includeCoverLetter ? application.coverLetter : undefined,
    recruiterTag: application.recruiterTag,
    appliedAt: iso(application.appliedAt),
    updatedAt: iso(application.updatedAt),
    interviewScheduledAt: iso(application.interviewScheduledAt),
    interviewerName: application.interviewerName,
    recruiterNotes: options.includeRecruiterNotes ? application.recruiterNotes : undefined,
    matchScore: application.matchScore,
    job: serializeJob(application.job, { publicRecruiter: true, includeRequisition: true }),
    candidate: options.minimalCandidate
      ? serializeCandidateSearchCard(application.candidate)
      : serializeCandidateProfile(application.candidate, { includePrivate: options.includeCandidatePrivate }),
    notes: application.notes?.map(serializeAtsNote),
    activities: application.activities?.map(serializeActivity),
    interviewProcesses: application.interviewProcesses?.map(serializeInterviewProcess),
  };
}

export function serializeSavedCandidate(savedCandidate, options = {}) {
  if (!savedCandidate) return null;
  return {
    id: savedCandidate.id,
    organisationId: savedCandidate.organisationId,
    tag: savedCandidate.tag,
    createdAt: iso(savedCandidate.createdAt),
    candidate: options.minimalCandidate
      ? serializeCandidateSearchCard(savedCandidate.candidate)
      : serializeCandidateProfile(savedCandidate.candidate, { includePrivate: true }),
  };
}

export function serializeResumeBuilder(resumeBuilder) {
  if (!resumeBuilder) return null;
  return {
    id: resumeBuilder.id,
    template: resumeBuilder.template,
    personal: resumeBuilder.personal,
    education: resumeBuilder.education,
    experience: resumeBuilder.experience,
    skills: resumeBuilder.skills,
    projects: resumeBuilder.projects,
    completedScore: resumeBuilder.completedScore,
    updatedAt: iso(resumeBuilder.updatedAt),
  };
}

export function serializeAuthSession(user, expiresAt, activeMembership = undefined) {
  return {
    user: serializeUser(user, { includePrivate: true, activeMembership }),
    expiresAt,
  };
}

export function serializeJobRequisition(requisition) {
  if (!requisition) return null;
  return {
    id: requisition.id,
    organisationId: requisition.organisationId,
    requisitionCode: requisition.requisitionCode,
    title: requisition.title,
    department: requisition.department,
    businessUnit: requisition.businessUnit,
    location: requisition.location,
    employmentType: requisition.employmentType,
    numberOfOpenings: requisition.numberOfOpenings,
    priority: requisition.priority,
    targetHireDate: iso(requisition.targetHireDate),
    status: requisition.status,
    reasonForHiring: requisition.reasonForHiring,
    replacementFor: requisition.replacementFor,
    budgetMin: requisition.budgetMin,
    budgetMax: requisition.budgetMax,
    currency: requisition.currency,
    approvalStatus: requisition.approvalStatus,
    approvedAt: iso(requisition.approvedAt),
    createdAt: iso(requisition.createdAt),
    updatedAt: iso(requisition.updatedAt),
    createdBy: requisition.createdBy ? { id: requisition.createdBy.id, email: requisition.createdBy.email } : undefined,
    approvedBy: requisition.approvedBy ? { id: requisition.approvedBy.id, email: requisition.approvedBy.email } : undefined,
    recruiter: requisition.recruiter ? { id: requisition.recruiter.id, email: requisition.recruiter.email } : undefined,
    hiringManager: requisition.hiringManager ? { id: requisition.hiringManager.id, email: requisition.hiringManager.email } : undefined,
  };
}

export function serializeInterviewFeedback(feedback) {
  if (!feedback) return null;
  return {
    id: feedback.id,
    organisationId: feedback.organisationId,
    interviewRoundId: feedback.interviewRoundId,
    interviewerId: feedback.interviewerId,
    submittedAt: iso(feedback.submittedAt),
    recommendation: feedback.recommendation,
    overallScore: feedback.overallScore,
    comments: feedback.comments,
    criteriaScores: feedback.criteriaScores,
    finalized: Boolean(feedback.finalizedAt),
    finalizedAt: iso(feedback.finalizedAt),
    createdAt: iso(feedback.createdAt),
    updatedAt: iso(feedback.updatedAt),
    interviewer: feedback.interviewer ? { id: feedback.interviewer.id, email: feedback.interviewer.email } : undefined,
  };
}

export function serializeInterviewRound(round) {
  if (!round) return null;
  return {
    id: round.id,
    organisationId: round.organisationId,
    interviewProcessId: round.interviewProcessId,
    roundName: round.roundName,
    sequence: round.sequence,
    interviewType: round.interviewType,
    status: round.status,
    scheduledStartAt: iso(round.scheduledStartAt),
    scheduledEndAt: iso(round.scheduledEndAt),
    scorecardCriteria: round.scorecardCriteria,
    feedbackLockedAt: iso(round.feedbackLockedAt),
    createdAt: iso(round.createdAt),
    updatedAt: iso(round.updatedAt),
    panelMembers: round.panelMembers?.map(serializeInterviewPanelMember),
    feedbacks: round.feedbacks?.map(serializeInterviewFeedback),
  };
}

export function serializeInterviewPanelMember(member) {
  if (!member) return null;
  return {
    id: member.id,
    organisationId: member.organisationId,
    interviewRoundId: member.interviewRoundId,
    userId: member.userId,
    createdAt: iso(member.createdAt),
    user: member.user ? { id: member.user.id, email: member.user.email, role: member.user.role } : undefined,
  };
}

export function serializeInterviewProcess(process) {
  if (!process) return null;
  return {
    id: process.id,
    organisationId: process.organisationId,
    applicationId: process.applicationId,
    title: process.title,
    status: process.status,
    createdAt: iso(process.createdAt),
    updatedAt: iso(process.updatedAt),
    createdBy: process.createdBy ? { id: process.createdBy.id, email: process.createdBy.email } : undefined,
    rounds: process.rounds?.map(serializeInterviewRound),
  };
}

export function serializeNotification(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    organisationId: notification.organisationId,
    recipientUserId: notification.recipientUserId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: iso(notification.readAt),
    createdAt: iso(notification.createdAt),
  };
}

export function serializeAuditLog(log) {
  if (!log) return null;
  return {
    id: log.id,
    organisationId: log.organisationId,
    actorUserId: log.actorUserId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    beforeData: log.beforeData,
    afterData: log.afterData,
    metadata: log.metadata,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: iso(log.createdAt),
  };
}
