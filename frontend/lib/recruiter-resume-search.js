const COMPANY_NAMES = [
  'Northstar Systems',
  'Astra Labs',
  'Vector Bridge',
  'Blue Orbit',
  'Meridian Stack',
  'Summit Works',
];

const INDUSTRIES = ['Software', 'Fintech', 'Cloud Infrastructure', 'Healthcare Tech', 'Consumer Internet'];
const FUNCTIONAL_AREAS = ['Engineering', 'Product', 'Design', 'Talent Acquisition', 'Data'];
const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'];
const TALENT_POOL_NAMES = ['High Priority', 'Leadership Radar', 'Future Frontend', 'Interview Ready'];

export const resumeSearchFilterSections = [
  {
    title: 'Requirement & Search',
    fields: [
      { type: 'text', name: 'jobId', label: 'Job Requirement', placeholder: 'Select a recruiter job' },
      { type: 'text', name: 'requisitionId', label: 'Requisition', placeholder: 'Approved requisition id' },
      { type: 'text', name: 'keyword', label: 'Keyword Search', placeholder: 'Java developer OR backend engineer' },
      { type: 'text', name: 'booleanQuery', label: 'Boolean Search', placeholder: '("Spring Boot" AND AWS) AND Bangalore' },
    ],
  },
  {
    title: 'Core Filters',
    fields: [
      { type: 'text', name: 'skills', label: 'Skills', placeholder: 'Java, Spring Boot, AWS' },
      { type: 'text', name: 'location', label: 'Location', placeholder: 'Bengaluru' },
      { type: 'text', name: 'currentCompany', label: 'Current Company', placeholder: 'Current company' },
      { type: 'text', name: 'previousCompany', label: 'Previous Company', placeholder: 'Previous company' },
      { type: 'text', name: 'designation', label: 'Designation', placeholder: 'Senior Java Developer' },
      { type: 'select', name: 'industry', label: 'Industry', options: ['', ...INDUSTRIES] },
      { type: 'select', name: 'functionalArea', label: 'Functional Area', options: ['', ...FUNCTIONAL_AREAS] },
      { type: 'select', name: 'employmentType', label: 'Employment Type', options: ['', 'Full-time', 'Contract', 'Part-time', 'Consulting'] },
    ],
  },
  {
    title: 'Experience & Compensation',
    fields: [
      { type: 'number', name: 'minExperience', label: 'Minimum Experience', placeholder: '0' },
      { type: 'number', name: 'maxExperience', label: 'Maximum Experience', placeholder: '10' },
      { type: 'select', name: 'noticePeriod', label: 'Notice Period', options: ['', 'Immediate', '15 Days', '30 Days', '60 Days', '90 Days'] },
      { type: 'text', name: 'currentSalary', label: 'Current Salary', placeholder: '20 LPA' },
      { type: 'text', name: 'expectedSalary', label: 'Expected Salary', placeholder: '26 LPA' },
      { type: 'select', name: 'availability', label: 'Availability', options: ['', 'IMMEDIATE', 'TWO_WEEKS', 'ONE_MONTH', 'NOT_LOOKING'] },
      { type: 'select', name: 'resumeFreshness', label: 'Resume Freshness', options: ['', 'Last 7 days', 'Last 30 days', 'Last 90 days'] },
      { type: 'select', name: 'resumeAttachment', label: 'Resume Attachment', options: ['', 'Available', 'Missing'] },
    ],
  },
  {
    title: 'Education & Credentials',
    fields: [
      { type: 'text', name: 'education', label: 'Education', placeholder: 'B.Tech, MCA, MBA' },
      { type: 'text', name: 'certifications', label: 'Certifications', placeholder: 'AWS, Azure, PMP' },
      { type: 'text', name: 'languages', label: 'Languages', placeholder: 'English, Hindi' },
      { type: 'select', name: 'workAuthorization', label: 'Work Authorization', options: ['', 'India', 'US', 'UK', 'EU'] },
    ],
  },
  {
    title: 'Signals & Preferences',
    fields: [
      { type: 'select', name: 'relocation', label: 'Relocation', options: ['', 'Open', 'Not open'] },
      { type: 'select', name: 'remotePreference', label: 'Remote Preference', options: ['', 'Remote-first', 'Hybrid', 'On-site'] },
      { type: 'select', name: 'candidateActivity', label: 'Candidate Activity', options: ['', 'Highly active', 'Moderately active', 'Passive'] },
      { type: 'select', name: 'diversity', label: 'Diversity', options: ['', 'Self-declared', 'Not specified'] },
      { type: 'select', name: 'careerBreak', label: 'Career Break', options: ['', 'No break', 'Open to returnship'] },
      { type: 'select', name: 'lastActive', label: 'Last Active', options: ['', 'Today', 'Last 7 days', 'Last 30 days'] },
      { type: 'select', name: 'candidateStatus', label: 'Hiring Activity', options: ['', 'Available', 'Shortlisted', 'Interview in Progress', 'Offer Stage', 'Notice Period', 'Recently Joined'] },
      { type: 'select', name: 'sortBy', label: 'Sort By', options: ['', 'relevance', 'resumeFreshness', 'experience'] },
    ],
  },
];

export const savedSearchPresets = [
  {
    label: 'Backend shortlist',
    params: {
      keyword: 'backend engineer',
      skills: 'Node.js, PostgreSQL',
      location: 'Bengaluru',
      minExperience: '4',
      maxExperience: '8',
    },
  },
  {
    label: 'Java + AWS',
    params: {
      keyword: 'Find a Java developer in Bangalore with Spring Boot and AWS, 6-10 years experience, available in 30 days.',
      skills: 'Java, Spring Boot, AWS',
      location: 'Bangalore',
      minExperience: '6',
      maxExperience: '10',
      availability: 'ONE_MONTH',
    },
  },
  {
    label: 'Design leadership',
    params: {
      keyword: 'design lead',
      location: 'Remote',
      candidateActivity: 'Highly active',
    },
  },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value = '') {
  return Array.from(String(value)).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function sentenceCase(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateLabel(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelativeLabel(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
}

function parseAvailabilityLabel(value, noticePeriodDays) {
  if (noticePeriodDays != null) {
    if (noticePeriodDays === 0) return 'Immediate';
    return `${noticePeriodDays} days`;
  }

  if (value === 'IMMEDIATE') return 'Immediate';
  if (value === 'TWO_WEEKS') return '15 days';
  if (value === 'ONE_MONTH') return '30 days';
  if (value === 'NOT_LOOKING') return 'Passive';
  return 'Unknown';
}

function deriveCompany(seed, offset = 0) {
  return COMPANY_NAMES[(seed + offset) % COMPANY_NAMES.length];
}

function deriveSalary(totalExperience, seed, delta = 0) {
  const base = 6 + totalExperience * 2 + ((seed + delta) % 4);
  const max = base + 5 + ((seed + delta) % 3);
  return `${base}-${max} LPA`;
}

function deriveNoticePeriod(availability, noticePeriodDays) {
  return parseAvailabilityLabel(availability, noticePeriodDays);
}

function deriveActivityBand(updatedAt) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return 'Moderately active';
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return 'Highly active';
  if (days <= 21) return 'Moderately active';
  return 'Passive';
}

function deriveGenericHiringStatus(seed) {
  return ['Available', 'Shortlisted', 'Interview Activity', 'Offer-Stage Activity', 'Notice Period', 'Recently Joined'][seed % 6];
}

function deriveAtsPipeline(candidate) {
  if (candidate.organisationApplications?.length) {
    return candidate.organisationApplications.map((application) => ({
      label: mapAtsStage(application.currentStage),
      active: true,
      current: true,
    }));
  }

  const seed = hashSeed(candidate.id || candidate.fullName);
  const stages = ['Applied', 'Screening', 'Technical', 'HR', 'Offer', 'Joined', 'Rejected'];
  const activeIndex = seed % stages.length;
  return stages.map((label, index) => ({
    label,
    active: index <= activeIndex,
    current: index === activeIndex,
  }));
}

function mapAtsStage(value = '') {
  if (value === 'SHORTLISTED') return 'Screening';
  if (value === 'INTERVIEW_SCHEDULED') return 'Technical';
  if (value === 'SELECTED') return 'Joined';
  if (!value) return 'Applied';
  return sentenceCase(value.replaceAll('_', ' '));
}

function extractRange(text) {
  const match = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s+years?/i);
  if (!match) return {};
  return {
    minExperience: match[1],
    maxExperience: match[2],
  };
}

function extractLocation(text) {
  const match = text.match(/\b(?:in|at)\s+([A-Za-z\s]+?)(?:\s+with|\s+\d|\s+available|$)/i);
  return match ? sentenceCase(match[1].trim()) : '';
}

function extractNotice(text) {
  const match = text.match(/available\s+in\s+(\d+)\s+days?/i);
  if (!match) return {};
  const days = Number(match[1]);
  if (days <= 0) return { availability: 'IMMEDIATE' };
  if (days <= 15) return { availability: 'TWO_WEEKS' };
  if (days <= 30) return { availability: 'ONE_MONTH' };
  return {};
}

function extractSkills(text) {
  const skillMatches = [];
  const sources = ['Java', 'Spring Boot', 'AWS', 'React', 'Node.js', 'PostgreSQL', 'Figma', 'Python', 'Golang', 'Kubernetes'];
  sources.forEach((skill) => {
    if (new RegExp(skill.replace('.', '\\.'), 'i').test(text)) {
      skillMatches.push(skill);
    }
  });
  return skillMatches.join(', ');
}

export function parseAiResumeQuery(text = '') {
  if (!text) return {};
  return {
    keyword: text,
    location: extractLocation(text),
    skills: extractSkills(text),
    ...extractRange(text),
    ...extractNotice(text),
  };
}

export function normalizeResumeSearchParams(rawParams = {}) {
  const params = {};
  for (const section of resumeSearchFilterSections) {
    for (const field of section.fields) {
      const value = rawParams?.[field.name];
      if (value == null || value === '') continue;
      params[field.name] = String(value);
    }
  }
  if (rawParams?.aiQuery) params.aiQuery = String(rawParams.aiQuery);
  if (rawParams?.page) params.page = String(rawParams.page);
  if (rawParams?.preview) params.preview = String(rawParams.preview);
  if (rawParams?.pool) params.pool = String(rawParams.pool);
  return params;
}

export function buildResumeSearchRequestParams(rawParams = {}) {
  const params = normalizeResumeSearchParams(rawParams);
  const aiDerived = params.aiQuery ? parseAiResumeQuery(params.aiQuery) : {};

  return {
    ...params,
    keyword: params.keyword || params.booleanQuery || aiDerived.keyword || '',
    location: params.location || aiDerived.location || '',
    minExperience: params.minExperience || aiDerived.minExperience || '',
    maxExperience: params.maxExperience || aiDerived.maxExperience || '',
    availability: params.availability || aiDerived.availability || '',
    skills: params.skills || aiDerived.skills || '',
  };
}

export function buildResumeSearchQueryEntries(rawParams = {}) {
  const params = buildResumeSearchRequestParams(rawParams);
  const query = {};
  [
    'jobId',
    'requisitionId',
    'keyword',
    'booleanQuery',
    'skills',
    'location',
    'minExperience',
    'maxExperience',
    'availability',
    'currentCompany',
    'previousCompany',
    'designation',
    'industry',
    'education',
    'noticePeriod',
    'currentSalary',
    'expectedSalary',
    'workAuthorization',
    'resumeFreshness',
    'lastActive',
    'resumeAttachment',
    'sortBy',
    'page',
  ].forEach((field) => {
    if (field === 'skills' && !rawParams.skills) {
      return;
    }
    if (params[field]) {
      query[field] = params[field];
    }
  });

  if (params.skills) query.skill = params.skills.split(',')[0].trim();
  if (params.candidateStatus === 'Shortlisted') query.tag = 'SHORTLISTED';
  return query;
}

export function decorateResumeCandidate(candidate, params = {}) {
  const seed = hashSeed(candidate.id || candidate.fullName);
  const title = candidate.currentTitle || candidate.title || candidate.headline || 'Candidate profile';
  const totalExperience = typeof candidate.totalExperience === 'number' ? candidate.totalExperience : toNumber(candidate.totalExperience) || 0;
  const noticePeriod = deriveNoticePeriod(candidate.availability, candidate.noticePeriodDays);
  const matchScore = clamp(
    candidate.matchScore || 68
      + Math.min(candidate.skills?.length || 0, 6) * 4
      + (params.keyword ? 4 : 0)
      + (params.location && candidate.location?.toLowerCase().includes(String(params.location).toLowerCase()) ? 6 : 0)
      + ((seed % 9) - 3),
    62,
    98,
  );
  const resumeScore = clamp(candidate.resumeScore || (70 + Math.min(candidate.skills?.length || 0, 5) * 4 + ((seed + 7) % 12)), 72, 99);

  return {
    ...candidate,
    title,
    totalExperienceLabel: `${totalExperience} yrs`,
    currentCompany: candidate.currentCompany || deriveCompany(seed),
    previousCompany: candidate.previousCompany || deriveCompany(seed, 2),
    designation: candidate.designation || title,
    industry: candidate.industry || INDUSTRIES[seed % INDUSTRIES.length],
    functionalArea: candidate.functionalArea || FUNCTIONAL_AREAS[seed % FUNCTIONAL_AREAS.length],
    noticePeriod,
    salaryLabel: candidate.salaryVisible === false
      ? 'Permission required'
      : candidate.currentSalary != null || candidate.expectedSalary != null
        ? `${candidate.currentSalary ?? 'NA'}-${candidate.expectedSalary ?? 'NA'} LPA`
        : deriveSalary(totalExperience, seed),
    expectedSalaryLabel: candidate.expectedSalary != null ? `${candidate.expectedSalary} LPA` : deriveSalary(totalExperience + 1, seed, 2),
    matchScore,
    resumeScore,
    updatedLabel: formatRelativeLabel(candidate.updatedAt || candidate.resumeUpdatedAt),
    lastUpdatedLabel: formatDateLabel(candidate.updatedAt || candidate.resumeUpdatedAt),
    resumeFreshness: candidate.updatedAt || candidate.resumeUpdatedAt,
    activityBand: deriveActivityBand(candidate.updatedAt || candidate.resumeUpdatedAt),
    globalHiringStatus: candidate.globalHiringActivity || deriveGenericHiringStatus(seed),
    remotePreference: candidate.remotePreference || ['Remote-first', 'Hybrid', 'On-site'][seed % 3],
    relocationPreference: candidate.relocationPreference || (seed % 2 === 0 ? 'Open to relocate' : 'Location anchored'),
    workAuthorizationLabel: candidate.workAuthorizationLabel || ['India', 'US', 'EU'][seed % 3],
    languages: candidate.languages || [LANGUAGES[seed % LANGUAGES.length], LANGUAGES[(seed + 2) % LANGUAGES.length]],
    diversityLabel: candidate.diversityLabel || (seed % 4 === 0 ? 'Self-declared' : 'Not specified'),
    careerBreakLabel: candidate.careerBreakLabel || (seed % 5 === 0 ? 'Returnship-ready' : 'No declared career break'),
    atsStatusLabel: candidate.ownOrganisationAtsStatus || candidate.atsStatusLabel || 'Not in ATS',
    talentPoolSuggestion: TALENT_POOL_NAMES[seed % TALENT_POOL_NAMES.length],
  };
}

export function decorateResumePreview(candidate) {
  const seed = hashSeed(candidate.id || candidate.fullName);
  const totalExperience = typeof candidate.totalExperience === 'number' ? candidate.totalExperience : toNumber(candidate.totalExperience) || 0;
  const aiSummary = candidate.resumeSummary || `${candidate.fullName} is a ${candidate.headline || candidate.currentTitle || 'candidate'} with ${totalExperience} years of experience, strongest around ${(candidate.skills || []).slice(0, 3).join(', ') || 'core hiring fit'}, and currently aligned to ${candidate.location || 'shared locations'} opportunities.`;
  const experienceTimeline = Array.isArray(candidate.resumeBuilder?.experience) && candidate.resumeBuilder.experience.length
    ? candidate.resumeBuilder.experience.map((item, index) => ({
        id: `${candidate.id}-exp-${index}`,
        title: item.title || item.role || 'Experience entry',
        company: item.company || deriveCompany(seed, index),
        summary: item.summary || item.description || 'Delivered cross-functional execution across product and hiring workflows.',
      }))
    : [
        {
          id: `${candidate.id}-exp-1`,
          title: candidate.currentTitle || candidate.headline || 'Current role',
          company: candidate.currentCompany || deriveCompany(seed),
          summary: 'Led execution across product delivery, collaboration, and measurable hiring workflows.',
        },
      ];

  const timeline = [
    { id: 'updated', label: 'Resume refreshed', value: formatDateLabel(candidate.updatedAt) },
    { id: 'active', label: 'Last active', value: formatDateLabel(candidate.lastActiveAt || candidate.updatedAt) },
    { id: 'availability', label: 'Notice period', value: deriveNoticePeriod(candidate.availability, candidate.noticePeriodDays) },
  ];

  const activity = [
    { id: 'activity', label: 'Candidate activity', value: deriveActivityBand(candidate.updatedAt) },
    { id: 'global', label: 'Global hiring status', value: candidate.globalHiringActivity || deriveGenericHiringStatus(seed) },
    { id: 'resume', label: 'Resume attachment', value: candidate.resumeDownloadUrl ? 'Available' : 'Not shared' },
  ];

  return {
    ...decorateResumeCandidate(candidate),
    aiSummary,
    experienceTimeline,
    timeline,
    activity,
    atsPipeline: candidate.atsPipeline || deriveAtsPipeline(candidate),
    talentPools: (candidate.talentPools || []).map((pool) => (typeof pool === 'string' ? pool : pool.name)),
    showContactInfo: Boolean(candidate.contact?.email || candidate.contact?.phone || candidate.user?.email),
    contactEmail: candidate.contact?.email || candidate.user?.email || null,
    contactPhone: candidate.contact?.phone || null,
    resumeUrl: candidate.resumeDownloadUrl || candidate.resumeUrl || null,
  };
}

export function buildSavedSearchHref(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return `/recruiter/database${query ? `?${query}` : ''}`;
}
