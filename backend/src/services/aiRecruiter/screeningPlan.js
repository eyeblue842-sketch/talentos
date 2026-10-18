// Pure planning helpers for AI voice screening - no env, no DB, no I/O - so
// they are trivially unit-testable and safe to import anywhere. The stateful
// orchestration (DB writes, provider dispatch) lives in aiRecruiterService.js.

// India numbers dial through Plivo (regulatory media-anchoring rules require an
// India-terminating platform); everyone else goes through Vapi.
export function resolveProvider(phoneE164) {
  const normalized = String(phoneE164 || '').replace(/[^\d+]/g, '');
  if (normalized.startsWith('+91') || normalized.startsWith('91')) {
    return 'PLIVO';
  }
  return 'VAPI';
}

export function pickCandidatePhone(candidate) {
  return candidate?.normalizedPhoneNumber || candidate?.phoneNumber || null;
}

export function deriveScreeningQuestions(job) {
  const skills = Array.isArray(job?.skillsRequired) ? job.skillsRequired.filter(Boolean) : [];
  if (skills.length) {
    return skills.slice(0, 5).map((skill) => `Can you briefly describe your hands-on experience with ${skill}?`);
  }
  return [
    'What are your strongest skills for this kind of role?',
    'Could you walk me through a recent project you worked on?',
  ];
}

export function deriveClientBrief(job) {
  const bits = [];
  if (job?.department) bits.push(job.department);
  if (job?.location) bits.push(`based in ${job.location}`);
  return bits.length ? `our client (${bits.join(', ')})` : 'one of our client companies';
}

export function summarize(text, maxLen = 400) {
  if (!text) return 'We can share the full details on the call.';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

// Build the exact variable map handed to the voice agent. Overrides (from the
// recruiter triggering the call) win; otherwise we derive sensible values from
// the Job and its screening questions.
export function buildPromptVariables({ job, candidate, overrides = {} }) {
  const screeningQuestions = Array.isArray(overrides?.screeningQuestions) && overrides.screeningQuestions.length
    ? overrides.screeningQuestions
    : deriveScreeningQuestions(job);

  const jobMode = overrides?.jobMode
    || job?.workplaceType
    || (job?.employmentType ? String(job.employmentType).replace(/_/g, ' ').toLowerCase() : null)
    || 'not specified';

  return {
    candidateName: candidate?.fullName || 'there',
    clientCompanyBrief: overrides?.clientCompanyBrief || deriveClientBrief(job),
    jobTitle: overrides?.jobTitle || job?.title || 'the role',
    jobLocation: overrides?.jobLocation || job?.location || 'not specified',
    jobMode,
    jobSummary: overrides?.jobSummary || summarize(job?.description),
    screeningQuestions,
    screeningQuestionsText: screeningQuestions.join(' | '),
  };
}

export function serializeScreeningCall(call) {
  if (!call) return null;
  return {
    id: call.id,
    applicationId: call.applicationId,
    jobId: call.jobId,
    candidateId: call.candidateId,
    provider: call.provider,
    status: call.status,
    outcome: call.outcome,
    dryRun: call.dryRun,
    toPhoneNumber: call.toPhoneNumber,
    callerId: call.callerId,
    consentCaptured: call.consentCaptured,
    requestedAt: call.requestedAt,
    dispatchedAt: call.dispatchedAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    endedReason: call.endedReason,
    recordingUrl: call.recordingUrl,
    transcript: call.transcript,
    results: {
      currentCtc: call.currentCtc,
      expectedCtc: call.expectedCtc,
      noticePeriod: call.noticePeriod,
      noticeNegotiable: call.noticeNegotiable,
      buyoutAvailable: call.buyoutAvailable,
      earliestJoinDate: call.earliestJoinDate,
      techAnswers: call.techAnswers,
      interestSummary: call.interestSummary,
      aiSummary: call.aiSummary,
    },
    errorMessage: call.errorMessage,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}
