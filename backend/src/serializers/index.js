function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeRecruiterProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
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
    resumeUrl: includePrivate ? profile.resumeUrl : undefined,
    sharedResumeSlug: profile.sharedResumeSlug,
    profileViews: includePrivate ? profile.profileViews : undefined,
    lastActiveAt: iso(profile.lastActiveAt),
    updatedAt: iso(profile.updatedAt),
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
  };
}

export function serializeJob(job, options = {}) {
  if (!job) return null;
  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    description: job.description,
    skillsRequired: job.skillsRequired,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    location: job.location,
    employmentType: job.employmentType,
    status: job.status,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    applicationsCount: job._count?.applications,
    recruiter: options.publicRecruiter ? serializePublicRecruiter(job.recruiter) : undefined,
  };
}

export function serializeActivity(activity) {
  if (!activity) return null;
  return {
    id: activity.id,
    message: activity.message,
    createdAt: iso(activity.createdAt),
  };
}

export function serializeAtsNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    applicationId: note.applicationId,
    authorId: note.authorId,
    content: note.content,
    createdAt: iso(note.createdAt),
    author: note.author
      ? {
          id: note.author.id,
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
    job: serializeJob(application.job, { publicRecruiter: true }),
    candidate: serializeCandidateProfile(application.candidate, { includePrivate: options.includeCandidatePrivate }),
    notes: application.notes?.map(serializeAtsNote),
    activities: application.activities?.map(serializeActivity),
  };
}

export function serializeSavedCandidate(savedCandidate) {
  if (!savedCandidate) return null;
  return {
    id: savedCandidate.id,
    tag: savedCandidate.tag,
    createdAt: iso(savedCandidate.createdAt),
    candidate: serializeCandidateProfile(savedCandidate.candidate, { includePrivate: true }),
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

export function serializeAuthSession(user, expiresAt) {
  return {
    user: serializeUser(user, { includePrivate: true }),
    expiresAt,
  };
}
