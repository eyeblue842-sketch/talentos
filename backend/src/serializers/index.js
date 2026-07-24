function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function resumeDownloadUrl(profile) {
  if (!profile?.id || (!profile?.resumeUrl && !profile?.latestResumeAssetId)) return undefined;
  return `/api/resumes/candidate/${profile.id}/download`;
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
    industry: organisation.industry,
    organisationSize: organisation.organisationSize,
    headquarters: organisation.headquarters,
    publicDescription: organisation.publicDescription,
    publicLocations: organisation.publicLocations || [],
    cultureSummary: organisation.cultureSummary,
    benefitsSummary: organisation.benefitsSummary,
    careersEnabled: organisation.careersEnabled,
    onboardingCompletedAt: iso(organisation.onboardingCompletedAt),
    createdAt: iso(organisation.createdAt),
    updatedAt: iso(organisation.updatedAt),
  };
}

export function serializePublicOrganisation(organisation) {
  if (!organisation) return null;
  return {
    id: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    website: organisation.website,
    logoUrl: organisation.logoUrl,
    publicDescription: organisation.publicDescription,
    industry: organisation.industry,
    organisationSize: organisation.organisationSize,
    headquarters: organisation.headquarters,
    publicLocations: organisation.publicLocations || [],
    cultureSummary: organisation.cultureSummary,
    benefitsSummary: organisation.benefitsSummary,
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
    customRoleDefinition: membership.customRoleDefinition
      ? {
          id: membership.customRoleDefinition.id,
          name: membership.customRoleDefinition.name,
          slug: membership.customRoleDefinition.slug,
        }
      : undefined,
    user: membership.user
      ? {
          id: membership.user.id,
          email: membership.user.email,
          role: membership.user.role,
          isActive: membership.user.isActive,
          accountStatus: membership.user.accountStatus,
          lastLoginAt: iso(membership.user.lastLoginAt),
          mfaEnabled: membership.user.mfaEnabled,
        }
      : undefined,
  };
}

export function serializeOrganisationUnit(unit) {
  if (!unit) return null;
  return {
    id: unit.id,
    organisationId: unit.organisationId,
    type: unit.type,
    name: unit.name,
    code: unit.code,
    description: unit.description,
    parentId: unit.parentId,
    status: unit.status,
    metadata: unit.metadata || {},
    archivedAt: iso(unit.archivedAt),
    createdAt: iso(unit.createdAt),
    updatedAt: iso(unit.updatedAt),
  };
}

export function serializeOrganisationSettings(settings) {
  if (!settings) return null;
  return {
    id: settings.id,
    organisationId: settings.organisationId,
    timezone: settings.timezone,
    currency: settings.currency,
    language: settings.language,
    dateFormat: settings.dateFormat,
    employmentTypes: settings.employmentTypes || [],
    workModes: settings.workModes || [],
    experienceBands: settings.experienceBands || [],
    defaultHiringWorkflow: settings.defaultHiringWorkflow || {},
    defaultOfferWorkflow: settings.defaultOfferWorkflow || {},
    interviewTemplates: settings.interviewTemplates || [],
    interviewSchedulingSettings: settings.interviewSchedulingSettings || {},
    offerTemplates: settings.offerTemplates || [],
    careerPageSettings: settings.careerPageSettings || {},
    emailBranding: settings.emailBranding || {},
    notificationDefaults: settings.notificationDefaults || {},
    lookupSettings: settings.lookupSettings || {},
    updatedByUserId: settings.updatedByUserId,
    createdAt: iso(settings.createdAt),
    updatedAt: iso(settings.updatedAt),
  };
}

export function serializeMeetingParticipant(participant) {
  if (!participant) return null;
  return {
    id: participant.id,
    organisationId: participant.organisationId,
    meetingId: participant.meetingId,
    userId: participant.userId,
    candidateId: participant.candidateId,
    email: participant.email,
    participantRole: participant.participantRole,
    required: participant.required,
    rsvpStatus: participant.rsvpStatus,
    attendanceStatus: participant.attendanceStatus,
    notifiedAt: iso(participant.notifiedAt),
    createdAt: iso(participant.createdAt),
    updatedAt: iso(participant.updatedAt),
    user: participant.user ? {
      id: participant.user.id,
      email: participant.user.email,
      role: participant.user.role,
    } : undefined,
    candidate: participant.candidate ? {
      id: participant.candidate.id,
      fullName: participant.candidate.fullName,
    } : undefined,
  };
}

export function serializeInterviewMeeting(meeting) {
  if (!meeting) return null;
  return {
    id: meeting.id,
    organisationId: meeting.organisationId,
    interviewRoundId: meeting.interviewRoundId,
    provider: meeting.provider,
    mode: meeting.mode,
    status: meeting.status,
    externalMeetingId: meeting.externalMeetingId,
    externalCalendarEventId: meeting.externalCalendarEventId,
    conferenceId: meeting.conferenceId,
    safeJoinUrl: meeting.safeJoinUrl,
    passcodeMetadata: meeting.passcodeMetadata || null,
    timezone: meeting.timezone,
    scheduledStartUtc: iso(meeting.scheduledStartUtc),
    scheduledEndUtc: iso(meeting.scheduledEndUtc),
    durationMinutes: meeting.durationMinutes,
    location: meeting.location,
    officeAddress: meeting.officeAddress,
    dialInInformation: meeting.dialInInformation,
    providerDisplayName: meeting.providerDisplayName,
    instructions: meeting.instructions,
    candidateInstructions: meeting.candidateInstructions,
    providerMetadata: meeting.providerMetadata || {},
    operationVersion: meeting.operationVersion,
    rescheduleCount: meeting.rescheduleCount,
    lastRescheduledAt: iso(meeting.lastRescheduledAt),
    providerLastSyncedAt: iso(meeting.providerLastSyncedAt),
    providerFailureCode: meeting.providerFailureCode,
    providerFailureMessage: meeting.providerFailureMessage,
    providerCancelledAt: iso(meeting.providerCancelledAt),
    createdByUserId: meeting.createdByUserId,
    updatedByUserId: meeting.updatedByUserId,
    createdAt: iso(meeting.createdAt),
    updatedAt: iso(meeting.updatedAt),
    participants: meeting.participants?.map(serializeMeetingParticipant),
    reminders: meeting.reminders?.map((reminder) => ({
      id: reminder.id,
      participantId: reminder.participantId,
      reminderType: reminder.reminderType,
      scheduledFor: iso(reminder.scheduledFor),
      status: reminder.status,
      backgroundTaskId: reminder.backgroundTaskId,
      sentAt: iso(reminder.sentAt),
      failureReason: reminder.failureReason,
      createdAt: iso(reminder.createdAt),
      updatedAt: iso(reminder.updatedAt),
    })),
    rescheduleRequests: meeting.rescheduleRequests?.map((request) => ({
      id: request.id,
      requestedByType: request.requestedByType,
      requestedByUserId: request.requestedByUserId,
      candidateId: request.candidateId,
      reasonCode: request.reasonCode,
      reasonText: request.reasonText,
      preferredTimezone: request.preferredTimezone,
      status: request.status,
      reviewedByUserId: request.reviewedByUserId,
      reviewedAt: iso(request.reviewedAt),
      decisionReason: request.decisionReason,
      createdAt: iso(request.createdAt),
      updatedAt: iso(request.updatedAt),
      options: request.options?.map((option) => ({
        id: option.id,
        proposedStartUtc: iso(option.proposedStartUtc),
        proposedEndUtc: iso(option.proposedEndUtc),
        timezone: option.timezone,
        priority: option.priority,
        createdAt: iso(option.createdAt),
      })),
    })),
    scheduleHistory: meeting.scheduleHistory?.map((item) => ({
      id: item.id,
      action: item.action,
      actorUserId: item.actorUserId,
      oldStartUtc: iso(item.oldStartUtc),
      oldEndUtc: iso(item.oldEndUtc),
      newStartUtc: iso(item.newStartUtc),
      newEndUtc: iso(item.newEndUtc),
      oldProvider: item.oldProvider,
      newProvider: item.newProvider,
      oldParticipantSnapshot: item.oldParticipantSnapshot || [],
      newParticipantSnapshot: item.newParticipantSnapshot || [],
      reason: item.reason,
      providerOperationId: item.providerOperationId,
      providerResult: item.providerResult || {},
      createdAt: iso(item.createdAt),
    })),
  };
}

export function serializeOrganisationRoleDefinition(roleDefinition) {
  if (!roleDefinition) return null;
  return {
    id: roleDefinition.id,
    organisationId: roleDefinition.organisationId,
    name: roleDefinition.name,
    slug: roleDefinition.slug,
    description: roleDefinition.description,
    isSystem: roleDefinition.isSystem,
    baseRole: roleDefinition.baseRole,
    permissions: roleDefinition.permissions || [],
    archivedAt: iso(roleDefinition.archivedAt),
    createdByUserId: roleDefinition.createdByUserId,
    updatedByUserId: roleDefinition.updatedByUserId,
    createdAt: iso(roleDefinition.createdAt),
    updatedAt: iso(roleDefinition.updatedAt),
  };
}

export function serializeNotificationTemplate(template) {
  if (!template) return null;
  return {
    id: template.id,
    organisationId: template.organisationId,
    key: template.key,
    category: template.category,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    enabled: template.enabled,
    updatedByUserId: template.updatedByUserId,
    createdAt: iso(template.createdAt),
    updatedAt: iso(template.updatedAt),
  };
}

export function serializeFeatureFlag(flag) {
  if (!flag) return null;
  return {
    id: flag.id,
    organisationId: flag.organisationId,
    key: flag.key,
    description: flag.description,
    enabled: flag.enabled,
    updatedByUserId: flag.updatedByUserId,
    createdAt: iso(flag.createdAt),
    updatedAt: iso(flag.updatedAt),
  };
}

export function serializeOrganisationInvitation(invitation) {
  if (!invitation) return null;
  return {
    id: invitation.id,
    organisationId: invitation.organisationId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: iso(invitation.expiresAt),
    acceptedAt: iso(invitation.acceptedAt),
    revokedAt: iso(invitation.revokedAt),
    createdAt: iso(invitation.createdAt),
    updatedAt: iso(invitation.updatedAt),
    organisation: serializeOrganisation(invitation.organisation),
    invitedByUser: invitation.invitedByUser
      ? { id: invitation.invitedByUser.id, email: invitation.invitedByUser.email, role: invitation.invitedByUser.role }
      : undefined,
    acceptedByUser: invitation.acceptedByUser
      ? { id: invitation.acceptedByUser.id, email: invitation.acceptedByUser.email, role: invitation.acceptedByUser.role }
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
    phoneNumber: includePrivate ? profile.phoneNumber : undefined,
    headline: profile.headline,
    currentTitle: profile.currentTitle,
    currentEmployer: includePrivate ? profile.currentEmployer : undefined,
    currentDesignation: includePrivate ? profile.currentDesignation : undefined,
    location: profile.location,
    preferredLocations: profile.preferredLocations,
    preferredRoles: profile.preferredRoles,
    totalExperience: profile.totalExperience,
    workplacePreferences: profile.workplacePreferences,
    employmentPreferences: profile.employmentPreferences,
    availability: profile.availability,
    employmentStatus: includePrivate ? profile.employmentStatus : undefined,
    lastWorkingDate: includePrivate ? iso(profile.lastWorkingDate) : undefined,
    willingToRelocate: includePrivate ? profile.willingToRelocate : undefined,
    noticePeriodDays: includePrivate ? profile.noticePeriodDays : undefined,
    skills: profile.skills,
    skillEntries: includePrivate ? profile.skillEntries || [] : undefined,
    experienceEntries: includePrivate ? profile.experienceEntries || [] : undefined,
    educationEntries: includePrivate ? profile.educationEntries || [] : undefined,
    certificationEntries: includePrivate ? profile.certificationEntries || [] : undefined,
    languageEntries: includePrivate ? profile.languageEntries || [] : undefined,
    projectEntries: includePrivate ? profile.projectEntries || [] : undefined,
    portfolioLinks: includePrivate ? profile.portfolioLinks || [] : undefined,
    summary: profile.summary,
    profileImageUrl: profile.profileImageUrl,
    portfolioUrl: profile.portfolioUrl,
    linkedInUrl: profile.linkedInUrl,
    githubUrl: profile.githubUrl,
    email: includePrivate ? profile.email : undefined,
    profileStatus: includePrivate ? profile.profileStatus : undefined,
    source: includePrivate ? profile.source : undefined,
    profileVisibility: includePrivate ? profile.profileVisibility : undefined,
    recommendationEnabled: includePrivate ? profile.recommendationEnabled : undefined,
    notifyForSavedJobUpdates: includePrivate ? profile.notifyForSavedJobUpdates : undefined,
    notifyForApplicationUpdates: includePrivate ? profile.notifyForApplicationUpdates : undefined,
    notifyForRecommendations: includePrivate ? profile.notifyForRecommendations : undefined,
    notifyForInterviews: includePrivate ? profile.notifyForInterviews : undefined,
    notifyForOffers: includePrivate ? profile.notifyForOffers : undefined,
    notifyForProfileReminders: includePrivate ? profile.notifyForProfileReminders : undefined,
    notifyForMarketing: includePrivate ? profile.notifyForMarketing : undefined,
    currentCtcLpa: includePrivate ? profile.currentCtcLpa : undefined,
    expectedCtcLpa: includePrivate ? profile.expectedCtcLpa : undefined,
    minExpectedSalary: includePrivate ? profile.minExpectedSalary : undefined,
    preferredCurrency: includePrivate ? profile.preferredCurrency : undefined,
    workAuthorization: includePrivate ? profile.workAuthorization : undefined,
    requiresVisaSponsorship: includePrivate ? profile.requiresVisaSponsorship : undefined,
    preferredIndustries: includePrivate ? profile.preferredIndustries : undefined,
    preferredCompanySizes: includePrivate ? profile.preferredCompanySizes : undefined,
    travelWillingness: includePrivate ? profile.travelWillingness : undefined,
    jobAlertEnabled: includePrivate ? profile.jobAlertEnabled : undefined,
    jobAlertFrequency: includePrivate ? profile.jobAlertFrequency : undefined,
    searchableProfile: includePrivate ? profile.searchableProfile : undefined,
    phoneVisibleToRecruiters: includePrivate ? profile.phoneVisibleToRecruiters : undefined,
    salaryVisibleToRecruiters: includePrivate ? profile.salaryVisibleToRecruiters : undefined,
    resumeVisibleToRecruiters: includePrivate ? profile.resumeVisibleToRecruiters : undefined,
    notificationPreferences: includePrivate ? profile.notificationPreferences : undefined,
    accountLifecycleStatus: includePrivate ? profile.accountLifecycleStatus : undefined,
    accountDeactivationRequestedAt: includePrivate ? iso(profile.accountDeactivationRequestedAt) : undefined,
    onboardingStep: includePrivate ? profile.onboardingStep : undefined,
    onboardingCompletedAt: includePrivate ? iso(profile.onboardingCompletedAt) : undefined,
    onboardingSkippedResume: includePrivate ? profile.onboardingSkippedResume : undefined,
    resumeUrl: includePrivate ? resumeDownloadUrl(profile) : undefined,
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
    resumeAvailable: Boolean(profile.resumeUrl || profile.latestResumeAssetId || profile.resumeBuilder),
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
    accountStatus: user.accountStatus,
    emailVerified: Boolean(user.emailVerifiedAt),
    lastLoginAt: iso(user.lastLoginAt),
    mfaEnabled: user.mfaEnabled,
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
    isPublic: job.isPublic,
    publicSalaryEnabled: job.publicSalaryEnabled,
    featuredInPortal: job.featuredInPortal,
    visibility: job.visibility,
    location: job.location,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    numberOfOpenings: job.numberOfOpenings,
    department: job.department,
    businessUnit: job.businessUnit,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    applicationDeadline: iso(job.applicationDeadline),
    applicationOpensAt: iso(job.applicationOpensAt),
    applicationClosesAt: iso(job.applicationClosesAt),
    maxApplications: job.maxApplications,
    targetHires: job.targetHires,
    autoCloseOnTargetHire: job.autoCloseOnTargetHire,
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
    screeningQuestions: job.screeningQuestions?.map((question) => ({
      id: question.id,
      templateId: question.templateId,
      questionText: question.questionText,
      internalLabel: question.internalLabel,
      helpText: question.helpText,
      placeholder: question.placeholder,
      questionType: question.questionType,
      required: question.required,
      displayOrder: question.displayOrder,
      isActive: question.isActive,
      config: question.config || {},
      validationConfig: question.validationConfig || {},
      rules: question.rules || [],
      createdAt: iso(question.createdAt),
      updatedAt: iso(question.updatedAt),
    })),
  };
}

export function serializePublicJob(job, options = {}) {
  if (!job) return null;
  const salaryVisible = Boolean(job.publicSalaryEnabled);
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    description: job.description,
    location: job.location,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: salaryVisible ? job.salaryMin : null,
    salaryMax: salaryVisible ? job.salaryMax : null,
    currency: salaryVisible ? job.currency : null,
    numberOfOpenings: job.numberOfOpenings,
    applicationDeadline: iso(job.applicationDeadline),
    applicationOpensAt: iso(job.applicationOpensAt),
    applicationClosesAt: iso(job.applicationClosesAt),
    visibility: job.visibility,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    postedAt: iso(job.createdAt),
    skillsRequired: job.skillsRequired || [],
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    benefits: job.benefits || [],
    organisation: serializePublicOrganisation(job.organisation),
    saved: options.saved ?? undefined,
    applyPath: `/jobs/${job.slug}#apply`,
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
    technicalRating: feedback.technicalRating,
    communicationRating: feedback.communicationRating,
    problemSolvingRating: feedback.problemSolvingRating,
    cultureFitRating: feedback.cultureFitRating,
    strengths: feedback.strengths,
    weaknesses: feedback.weaknesses,
    detailedNotes: feedback.detailedNotes,
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
    durationMinutes: round.durationMinutes,
    ownerUserId: round.ownerUserId,
    timezone: round.timezone,
    meetingMode: round.meetingMode,
    scheduledStartAt: iso(round.scheduledStartAt),
    scheduledEndAt: iso(round.scheduledEndAt),
    meetingLocation: round.meetingLocation,
    meetingLink: round.meetingLink,
    officeAddress: round.officeAddress,
    candidateInstructions: round.candidateInstructions,
    instructions: round.instructions,
    internalNotes: round.internalNotes,
    cancelReason: round.cancelReason,
    scorecardCriteria: round.scorecardCriteria,
    feedbackLockedAt: iso(round.feedbackLockedAt),
    decision: round.decision,
    decisionReason: round.decisionReason,
    completedAt: iso(round.completedAt),
    calendarProvider: round.calendarProvider,
    rescheduleCount: round.rescheduleCount,
    lastRescheduledAt: iso(round.lastRescheduledAt),
    createdAt: iso(round.createdAt),
    updatedAt: iso(round.updatedAt),
    owner: round.owner ? { id: round.owner.id, email: round.owner.email, role: round.owner.role } : undefined,
    panelMembers: round.panelMembers?.map(serializeInterviewPanelMember),
    feedbacks: round.feedbacks?.map(serializeInterviewFeedback),
    meeting: round.meeting ? serializeInterviewMeeting(round.meeting) : undefined,
  };
}

export function serializeInterviewPanelMember(member) {
  if (!member) return null;
  return {
    id: member.id,
    organisationId: member.organisationId,
    interviewRoundId: member.interviewRoundId,
    userId: member.userId,
    isLead: member.isLead,
    isObserver: member.isObserver,
    feedbackRequired: member.feedbackRequired,
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

function sanitizePathSegment(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(trimmed) ? trimmed : null;
}

function resolveCandidateNotificationLink(notification) {
  const applicationId = sanitizePathSegment(notification.metadata?.applicationId || notification.entityId);
  const jobSlug = sanitizePathSegment(notification.metadata?.jobSlug);
  const destination = sanitizePathSegment(notification.metadata?.destinationType);

  if (notification.entityType === 'Application' && applicationId) {
    return `/candidate/applications/${applicationId}`;
  }

  if (notification.entityType === 'InterviewRound') {
    return applicationId ? `/candidate/applications/${applicationId}` : '/candidate/applications';
  }

  if (notification.entityType === 'Offer') {
    const offerId = sanitizePathSegment(notification.metadata?.offerId || notification.entityId);
    if (offerId) {
      return `/candidate/offers/${offerId}`;
    }
    return applicationId ? `/candidate/applications/${applicationId}` : '/candidate/applications';
  }

  if (notification.entityType === 'Job') {
    return jobSlug ? `/jobs/${jobSlug}` : '/candidate/saved-jobs';
  }

  if (destination === 'SAVED_JOBS') {
    return '/candidate/saved-jobs';
  }

  if (destination === 'PROFILE') {
    return '/candidate/profile';
  }

  if (destination === 'PREFERENCES') {
    return '/candidate/settings';
  }

  return '/candidate/notifications';
}

export function serializeCandidateNotification(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: iso(notification.readAt),
    createdAt: iso(notification.createdAt),
    isUnread: !notification.readAt,
    link: resolveCandidateNotificationLink(notification),
  };
}

export function serializeSavedJob(savedJob, options = {}) {
  if (!savedJob) return null;
  return {
    id: savedJob.id,
    createdAt: iso(savedJob.createdAt),
    job: savedJob.job ? serializePublicJob(savedJob.job, options) : null,
    snapshot: {
      slug: savedJob.jobSlugSnapshot,
      title: savedJob.jobTitleSnapshot,
      organisationName: savedJob.organisationNameSnapshot,
    },
    status: savedJob.job?.status || 'REMOVED',
    isActive: Boolean(savedJob.job && savedJob.job.status === 'OPEN' && !savedJob.job.archivedAt),
    savedAt: iso(savedJob.createdAt),
    closingAt: iso(savedJob.job?.applicationClosesAt || savedJob.job?.applicationDeadline),
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
