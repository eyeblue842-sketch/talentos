function scrubText(value = '', maxLength = 180) {
  return String(value || '')
    .replace(/[<>{}`$]/g, ' ')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function confidence(score) {
  if (score == null || Number.isNaN(score)) {
    return {
      score: null,
      label: 'UNKNOWN',
    };
  }
  if (score >= 80) return { score: Number((score / 100).toFixed(2)), label: 'HIGH' };
  if (score >= 55) return { score: Number((score / 100).toFixed(2)), label: 'MEDIUM' };
  return { score: Number((score / 100).toFixed(2)), label: 'LOW' };
}

function evidenceItem({ id, sourceType, sourceId = null, fieldPath, snippet, score = null, locator = null }) {
  return {
    id,
    sourceType,
    sourceId,
    fieldPath,
    snippet: scrubText(snippet) || null,
    confidence: confidence(score),
    generationType: 'DETERMINISTIC',
    locator,
  };
}

function uniqueSkillList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => scrubText(item, 120)).filter(Boolean))];
}

function currentEducationSnippet(candidate) {
  const entries = Array.isArray(candidate.educationEntries) ? candidate.educationEntries : [];
  const first = entries[0];
  if (!first) return 'Structured education details are unavailable.';
  return `${first.degree || first.qualification || 'Qualification'} at ${first.institution || first.school || first.university || 'Institution'}`;
}

export function buildCandidateMatchEvidenceCatalog({ candidate, job, candidateIntelligenceState = null, jobDescriptionState = null, scoring }) {
  const candidateSkills = uniqueSkillList(candidate.skills || []);
  const jobRequired = uniqueSkillList(job.skillsRequired || []);
  const jobPreferred = uniqueSkillList(job.skillsPreferred || []);

  return {
    overall: [
      evidenceItem({
        id: 'ev_required_skills',
        sourceType: 'JOB',
        sourceId: job.id,
        fieldPath: 'skillsRequired',
        snippet: jobRequired.join(', ') || 'No required skills listed.',
        score: scoring.subscores.requiredSkills,
        locator: 'job.skillsRequired',
      }),
      evidenceItem({
        id: 'ev_experience',
        sourceType: 'CANDIDATE_PROFILE',
        sourceId: candidate.id,
        fieldPath: 'totalExperience',
        snippet: `${candidate.totalExperience || 0} years total experience`,
        score: scoring.subscores.experience,
        locator: 'candidate.totalExperience',
      }),
      evidenceItem({
        id: 'ev_title_alignment',
        sourceType: 'CANDIDATE_PROFILE',
        sourceId: candidate.id,
        fieldPath: 'currentTitle',
        snippet: candidate.currentTitle || candidate.headline || candidate.fullName,
        score: scoring.subscores.roleTitle,
        locator: 'candidate.currentTitle',
      }),
    ],
    areas: {
      requiredSkills: [
        evidenceItem({
          id: 'ev_required_skills',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'skillsRequired',
          snippet: jobRequired.join(', ') || 'No required skills listed.',
          score: scoring.subscores.requiredSkills,
          locator: 'job.skillsRequired',
        }),
        evidenceItem({
          id: 'ev_candidate_skills',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'skills',
          snippet: candidateSkills.join(', ') || 'No explicit candidate skills listed.',
          score: scoring.subscores.requiredSkills,
          locator: 'candidate.skills',
        }),
      ],
      preferredSkills: [
        evidenceItem({
          id: 'ev_preferred_skills',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'skillsPreferred',
          snippet: jobPreferred.join(', ') || 'No preferred skills listed.',
          score: scoring.subscores.preferredSkills,
          locator: 'job.skillsPreferred',
        }),
        evidenceItem({
          id: 'ev_candidate_skills',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'skills',
          snippet: candidateSkills.join(', ') || 'No explicit candidate skills listed.',
          score: scoring.subscores.preferredSkills,
          locator: 'candidate.skills',
        }),
      ],
      experience: [
        evidenceItem({
          id: 'ev_experience',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'totalExperience',
          snippet: `${candidate.totalExperience || 0} years total experience`,
          score: scoring.subscores.experience,
          locator: 'candidate.totalExperience',
        }),
        evidenceItem({
          id: 'ev_job_experience',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'experienceRange',
          snippet: `${job.experienceMin ?? 0}-${job.experienceMax ?? 0} years requested`,
          score: scoring.subscores.experience,
          locator: 'job.experienceMin',
        }),
      ],
      roleTitle: [
        evidenceItem({
          id: 'ev_title_alignment',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'currentTitle',
          snippet: candidate.currentTitle || candidate.headline || candidate.fullName,
          score: scoring.subscores.roleTitle,
          locator: 'candidate.currentTitle',
        }),
        evidenceItem({
          id: 'ev_job_title',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'title',
          snippet: job.title,
          score: scoring.subscores.roleTitle,
          locator: 'job.title',
        }),
      ],
      location: [
        evidenceItem({
          id: 'ev_candidate_location',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'location',
          snippet: candidate.location || candidate.currentCity || 'Location unavailable',
          score: scoring.subscores.location,
          locator: 'candidate.location',
        }),
        evidenceItem({
          id: 'ev_job_location',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'location',
          snippet: job.location || 'Location unavailable',
          score: scoring.subscores.location,
          locator: 'job.location',
        }),
      ],
      workMode: [
        evidenceItem({
          id: 'ev_work_mode',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'workplaceType',
          snippet: job.workplaceType || 'Work mode unspecified',
          score: scoring.subscores.workMode,
          locator: 'job.workplaceType',
        }),
      ],
      employmentType: [
        evidenceItem({
          id: 'ev_employment_type',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'employmentType',
          snippet: job.employmentType || 'Employment type unspecified',
          score: scoring.subscores.employmentType,
          locator: 'job.employmentType',
        }),
      ],
      noticePeriod: [
        evidenceItem({
          id: 'ev_notice_period',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'noticePeriodDays',
          snippet: candidate.noticePeriodDays == null ? 'Notice period unavailable' : `${candidate.noticePeriodDays} day notice period`,
          score: scoring.subscores.noticePeriod,
          locator: 'candidate.noticePeriodDays',
        }),
      ],
      compensation: [
        evidenceItem({
          id: 'ev_compensation',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'expectedCtcLpa',
          snippet: candidate.expectedCtcLpa == null ? 'Expected compensation unavailable' : `Expected compensation ${candidate.expectedCtcLpa} LPA`,
          score: scoring.subscores.compensation,
          locator: 'candidate.expectedCtcLpa',
        }),
        evidenceItem({
          id: 'ev_job_compensation',
          sourceType: 'JOB',
          sourceId: job.id,
          fieldPath: 'salaryMax',
          snippet: job.salaryMax == null ? 'Job compensation range unavailable' : `Salary range up to ${job.salaryMax}`,
          score: scoring.subscores.compensation,
          locator: 'job.salaryMax',
        }),
      ],
      education: [
        evidenceItem({
          id: 'ev_education',
          sourceType: 'CANDIDATE_PROFILE',
          sourceId: candidate.id,
          fieldPath: 'educationEntries',
          snippet: currentEducationSnippet(candidate),
          score: scoring.subscores.education,
          locator: 'candidate.educationEntries[0]',
        }),
      ],
    },
    external: {
      candidateIntelligence: candidateIntelligenceState ? evidenceItem({
        id: 'ev_candidate_intelligence',
        sourceType: 'CANDIDATE_INTELLIGENCE',
        sourceId: candidateIntelligenceState.id,
        fieldPath: 'latestResultId',
        snippet: `Candidate intelligence ${candidateIntelligenceState.status.toLowerCase()} with result ${candidateIntelligenceState.latestResultId || 'pending'}`,
        score: 70,
        locator: 'candidateIntelligenceState.latestResultId',
      }) : null,
      jobDescription: jobDescriptionState ? evidenceItem({
        id: 'ev_job_description_intelligence',
        sourceType: 'JOB_DESCRIPTION',
        sourceId: jobDescriptionState.id,
        fieldPath: 'latestResultId',
        snippet: `Job description intelligence ${jobDescriptionState.status.toLowerCase()} with result ${jobDescriptionState.latestResultId || 'pending'}`,
        score: 70,
        locator: 'jobDescriptionState.latestResultId',
      }) : null,
    },
  };
}
