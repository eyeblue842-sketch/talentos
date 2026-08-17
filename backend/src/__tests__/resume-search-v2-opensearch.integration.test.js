import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

let OpenSearchResumeSearchAdapter;
let searchResumesV2;
let buildResumeSearchDocument;
let buildResumeSearchVisibilityFilter;
let buildResumeSearchIndexMapping;
let buildResumeSearchIndexName;
let resumeSearchAdapter;
let env;
let adapter;
let restoreOpenPointInTime;

const runIntegration = process.env.OPENSEARCH_INTEGRATION_ENABLED === 'true';
const integrationTest = runIntegration ? test : test.skip;

function baseDoc(overrides = {}) {
  return {
    documentId: overrides.documentId || `candidate:${overrides.candidateId}`,
    candidateId: overrides.candidateId,
    resumeId: overrides.resumeId || `resume:${overrides.candidateId}`,
    importItemId: overrides.importItemId || `import:${overrides.candidateId}`,
    resumeSource: overrides.resumeSource || 'BULK_IMPORT',
    sourceOrganisationId: overrides.sourceOrganisationId || 'org-a',
    visibilityClassification: overrides.visibilityClassification || 'GLOBAL_RECRUITER_DATABASE',
    contactVisibilityClassification: 'HIDDEN',
    searchableProfile: overrides.searchableProfile ?? true,
    normalizedName: overrides.normalizedName || overrides.candidateId,
    currentTitle: overrides.currentTitle || 'Engineer',
    previousTitles: overrides.previousTitles || [],
    normalizedSkills: overrides.normalizedSkills || [],
    rawSkills: overrides.rawSkills || overrides.normalizedSkills || [],
    totalExperienceMonths: overrides.totalExperienceMonths ?? 60,
    currentEmployer: overrides.currentEmployer || 'Example Corp',
    previousEmployers: overrides.previousEmployers || [],
    industries: overrides.industries || ['technology'],
    employmentHistoryText: overrides.employmentHistoryText || '',
    projectsText: overrides.projectsText || '',
    educationText: overrides.educationText || '',
    educationSummary: overrides.educationSummary || null,
    certifications: overrides.certifications || [],
    languages: overrides.languages || ['english'],
    currentLocation: overrides.currentLocation || 'bengaluru',
    preferredLocations: overrides.preferredLocations || [],
    noticePeriodDays: overrides.noticePeriodDays ?? 30,
    salarySearchable: overrides.salarySearchable ?? false,
    currentSalaryNormalized: overrides.currentSalaryNormalized ?? null,
    expectedSalaryNormalized: overrides.expectedSalaryNormalized ?? null,
    profileCompletenessScore: overrides.profileCompletenessScore ?? 50,
    parsingConfidence: overrides.parsingConfidence ?? 0.9,
    reviewRequired: overrides.reviewRequired ?? false,
    resumeUpdatedAt: overrides.resumeUpdatedAt || '2026-08-17T10:00:00.000Z',
    profileUpdatedAt: overrides.profileUpdatedAt || '2026-08-17T10:00:00.000Z',
    sourceVersion: overrides.sourceVersion || `v:${overrides.candidateId}`,
    indexSchemaVersion: 'v2',
  };
}

async function refreshIndex(indexName) {
  await adapter.client.indices.refresh({ index: indexName });
}

async function search(payload, actorUser) {
  return searchResumesV2(actorUser, payload, {
    ipAddress: '127.0.0.1',
    userAgent: 'resume-search-v2-opensearch-test',
  });
}

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ OpenSearchResumeSearchAdapter, resumeSearchAdapter } = await import('../services/resumeSearchV2/openSearchAdapter.js'));
  ({ searchResumesV2 } = await import('../services/resumeSearchV2/service.js'));
  ({ buildResumeSearchDocument } = await import('../services/resumeSearchV2/documentBuilder.js'));
  ({ buildResumeSearchVisibilityFilter } = await import('../services/resumeSearchV2/visibility.js'));
  ({
    buildResumeSearchIndexMapping,
    buildResumeSearchIndexName,
  } = await import('../services/resumeSearchV2/mapping.js'));
  env.openSearchCursorSecret = 'resume-search-v2-opensearch-secret';

  if (!runIntegration) return;

  adapter = new OpenSearchResumeSearchAdapter({
    node: process.env.OPENSEARCH_NODE || 'http://127.0.0.1:9201',
    indexPrefix: `careeriz-resume-search-it-${Date.now()}`,
  });

  const v1IndexName = buildResumeSearchIndexName(adapter.indexPrefix, 'v1');
  await adapter.client.indices.create({
    index: v1IndexName,
    body: buildResumeSearchIndexMapping('v1'),
  }).catch(() => {});

  await adapter.ensureIndexVersion();

  resumeSearchAdapter.client = adapter.client;
  resumeSearchAdapter.node = adapter.node;
  resumeSearchAdapter.indexPrefix = adapter.indexPrefix;
  resumeSearchAdapter.schemaVersion = adapter.schemaVersion;
  restoreOpenPointInTime = resumeSearchAdapter.openPointInTime.bind(resumeSearchAdapter);
  resumeSearchAdapter.openPointInTime = function patchedOpenPointInTime(keepAlive = '2m') {
    return OpenSearchResumeSearchAdapter.prototype.openPointInTime.call(this, keepAlive, this.indexName);
  };

  const redactedDoc = buildResumeSearchDocument({
    id: 'candidate-redacted',
    organisationId: 'org-b',
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'RECRUITERS_ONLY',
    profileStatus: 'ACTIVE',
    fullName: 'Riya Search',
    currentTitle: 'Java Recruiter',
    currentEmployer: 'Platform Talent',
    location: 'bengaluru',
    preferredLocations: ['mumbai'],
    totalExperience: 7,
    skills: ['Java', 'Spring Boot', 'AWS'],
    educationEntries: [{ degree: 'MBA', institution: 'Metro University', specialization: 'Human Resources' }],
    certificationEntries: [{ name: 'AWS Certified Solutions Architect' }],
    experienceEntries: [{
      title: 'Java Recruiter',
      company: 'Platform Talent',
      isCurrent: true,
      summary: 'Email TEST.USER@Example.COM and call +91 98765 43210. Experience 7 years and notice 30 days.',
      skills: ['Java', 'Spring Boot'],
    }],
    projectEntries: [{
      projectName: 'Candidate Search',
      summary: 'LinkedIn https://www.linkedin.com/in/test-user-123 and Address Flat 12, MG Road, Bengaluru 560001, India.',
      skills: ['AWS'],
    }],
    languageEntries: [{ language: 'English' }],
    parserMetadata: {},
    summary: 'Technical recruiter',
    source: 'BULK_IMPORT',
    updatedAt: new Date('2026-08-17T10:00:00.000Z'),
  }, {
    id: 'resume-redacted',
    status: 'ACTIVE',
    parsedText: 'Private raw resume text with TEST.USER@Example.COM and +91 98765 43210 and Flat 12, MG Road, Bengaluru 560001.',
    updatedAt: new Date('2026-08-17T10:00:00.000Z'),
  });

  await adapter.bulkIndexResumes([
    redactedDoc,
    baseDoc({
      candidateId: 'candidate-it-sales-global',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'IT Sales Manager',
      normalizedSkills: ['IT', 'Sales', 'SaaS'],
      previousTitles: ['Sales Lead'],
      employmentHistoryText: 'Led enterprise IT sales for SaaS products',
      projectsText: 'SaaS go-to-market execution',
      certifications: ['AWS'],
      educationSummary: 'MBA, Sales, Business School',
      totalExperienceMonths: 96,
      profileCompletenessScore: 90,
      profileUpdatedAt: '2026-08-17T10:05:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-ordinary-it',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Sales Operations Manager',
      normalizedSkills: ['Sales'],
      employmentHistoryText: 'Managed revenue targets and it was a key initiative',
      projectsText: 'General business systems project',
      profileCompletenessScore: 45,
      totalExperienceMonths: 84,
      profileUpdatedAt: '2026-08-17T10:04:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-java-ranked',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Senior Java Engineer',
      normalizedSkills: ['Java', 'Spring Boot', 'AWS'],
      projectsText: 'Built Spring Boot microservices on AWS',
      educationSummary: 'BTech, Computer Science, Tech University',
      certifications: ['AWS Developer Associate'],
      profileCompletenessScore: 88,
      totalExperienceMonths: 72,
    }),
    baseDoc({
      candidateId: 'candidate-java-only',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Java Engineer',
      normalizedSkills: ['Java'],
      projectsText: 'Built Java services',
      profileCompletenessScore: 62,
      totalExperienceMonths: 60,
    }),
    baseDoc({
      candidateId: 'candidate-apex',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Oracle APEX Developer',
      normalizedSkills: ['Oracle APEX', 'PL/SQL'],
      projectsText: 'Oracle Application Express and PL/SQL modernization',
      profileCompletenessScore: 78,
    }),
    baseDoc({
      candidateId: 'candidate-prev-only-match',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'People Operations Lead',
      previousTitles: ['Oracle APEX Developer', 'Business HR Partner'],
      normalizedSkills: ['Recruitment'],
      employmentHistoryText: 'Former Oracle APEX Developer and Business HR Partner',
      profileCompletenessScore: 71,
    }),
    baseDoc({
      candidateId: 'candidate-current-only-apex',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Oracle APEX Developer',
      previousTitles: ['Support Analyst'],
      normalizedSkills: ['Oracle'],
      employmentHistoryText: 'Current Oracle APEX role only',
      profileCompletenessScore: 58,
    }),
    baseDoc({
      candidateId: 'candidate-prev-only-second',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Talent Manager',
      previousTitles: ['Business HR Partner'],
      normalizedSkills: ['Human Resources'],
      employmentHistoryText: 'Previously a Business HR Partner',
      profileCompletenessScore: 68,
    }),
    baseDoc({
      candidateId: 'candidate-ta',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Talent Acquisition Partner',
      normalizedSkills: ['Talent Acquisition', 'Recruitment'],
      employmentHistoryText: 'Talent Acquisition for enterprise hiring',
      profileCompletenessScore: 86,
    }),
    baseDoc({
      candidateId: 'candidate-internship',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Talent Acquisition Internship',
      normalizedSkills: ['Talent Acquisition'],
      employmentHistoryText: 'Internship in talent acquisition',
      profileCompletenessScore: 35,
    }),
    baseDoc({
      candidateId: 'candidate-c',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Embedded C Developer',
      normalizedSkills: ['C'],
      projectsText: 'C firmware development',
      profileCompletenessScore: 52,
    }),
    baseDoc({
      candidateId: 'candidate-cpp',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'C++ Engineer',
      normalizedSkills: ['C++'],
      projectsText: 'Modern C++ systems programming',
      profileCompletenessScore: 57,
    }),
    baseDoc({
      candidateId: 'candidate-csharp',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'C# Engineer',
      normalizedSkills: ['C#', '.NET'],
      projectsText: '.NET backend services',
      profileCompletenessScore: 64,
    }),
    baseDoc({
      candidateId: 'candidate-node',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Node.js Engineer',
      normalizedSkills: ['Node.js'],
      projectsText: 'Node.js APIs and services',
      profileCompletenessScore: 61,
    }),
    baseDoc({
      candidateId: 'candidate-phrase',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Business HR Partner',
      previousTitles: ['HR Generalist'],
      normalizedSkills: ['Human Resources'],
      employmentHistoryText: 'Business HR Partner for enterprise operations',
      profileCompletenessScore: 75,
    }),
    baseDoc({
      candidateId: 'candidate-private-org-b',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'ORGANISATION_PRIVATE',
      currentTitle: 'Private Sales Manager',
      normalizedSkills: ['Sales'],
      employmentHistoryText: 'Private organisation-only resume',
      profileCompletenessScore: 72,
      profileUpdatedAt: '2026-08-17T10:03:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-private-org-a',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'ORGANISATION_PRIVATE',
      currentTitle: 'Private IT Recruiter',
      normalizedSkills: ['IT', 'Recruitment'],
      employmentHistoryText: 'Private org A resume',
      profileCompletenessScore: 69,
    }),
    baseDoc({
      candidateId: 'candidate-public',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'CANDIDATE_PUBLIC',
      currentTitle: 'Public QA Engineer',
      normalizedSkills: ['QA'],
      employmentHistoryText: 'Public candidate profile',
      profileCompletenessScore: 48,
      profileUpdatedAt: '2026-08-17T10:02:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-exp-tie-a',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor One',
      normalizedSkills: ['Search'],
      totalExperienceMonths: 48,
      currentLocation: 'cursor-city',
      profileCompletenessScore: 44,
      profileUpdatedAt: '2026-08-17T10:11:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-exp-tie-b',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor Two',
      normalizedSkills: ['Search'],
      totalExperienceMonths: 48,
      currentLocation: 'cursor-city',
      profileCompletenessScore: 46,
      profileUpdatedAt: '2026-08-17T10:10:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-exp-tie-c',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor Three',
      normalizedSkills: ['Search'],
      totalExperienceMonths: 24,
      currentLocation: 'cursor-city',
      profileCompletenessScore: 42,
      profileUpdatedAt: '2026-08-17T10:09:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-archived',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'NOT_SEARCHABLE',
      currentTitle: 'Archived Candidate',
      normalizedSkills: ['Sales'],
      employmentHistoryText: 'Should never appear',
      searchableProfile: false,
      profileCompletenessScore: 12,
    }),
    baseDoc({
      candidateId: 'candidate-salary-visible',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Senior Data Engineer',
      normalizedSkills: ['Python'],
      currentLocation: 'hyderabad',
      totalExperienceMonths: 108,
      noticePeriodDays: 60,
      salarySearchable: true,
      currentSalaryNormalized: 2800000,
      expectedSalaryNormalized: 3200000,
      profileCompletenessScore: 83,
    }),
    baseDoc({
      candidateId: 'candidate-salary-hidden',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Data Engineer',
      normalizedSkills: ['Python'],
      currentLocation: 'hyderabad',
      totalExperienceMonths: 72,
      noticePeriodDays: 30,
      salarySearchable: false,
      currentSalaryNormalized: null,
      expectedSalaryNormalized: null,
      profileCompletenessScore: 55,
    }),
    baseDoc({
      candidateId: 'candidate-safe-fields',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: '<mark>Lead</mark> Engineer',
      normalizedSkills: ['Java', '<mark>AWS</mark>'],
      educationSummary: '<script>alert(1)</script> MBA, Engineering, Safe University',
      certifications: ['<mark>OCI</mark> Architect'],
      projectsText: 'AWS and Java delivery',
      profileCompletenessScore: 81,
    }),
  ], adapter.indexName);

  await refreshIndex(adapter.indexName);
});

after(async () => {
  if (resumeSearchAdapter && restoreOpenPointInTime) {
    resumeSearchAdapter.openPointInTime = restoreOpenPointInTime;
  }
  if (!adapter?.client) return;
  await adapter.client.indices.delete({ index: `${adapter.indexPrefix}-*` }).catch(() => {});
});

integrationTest('real OpenSearch integration covers v2 mapping, v1 rebuildability, safe result fields, visibility, filters, phrases, and cursor paging without alias switching', async () => {
  const recruiterOrgA = {
    id: 'recruiter-a',
    role: 'RECRUITER',
    activeMembership: { organisationId: 'org-a', role: 'RECRUITER' },
  };
  const recruiterOrgB = {
    id: 'recruiter-b',
    role: 'RECRUITER',
    activeMembership: { organisationId: 'org-b', role: 'RECRUITER' },
  };

  const aliasValidation = await adapter.validateAliases({ indexName: adapter.indexName });
  assert.equal(aliasValidation.readAliasMatches, false);
  assert.equal(aliasValidation.writeAliasMatches, false);

  const mapping = await adapter.client.indices.getMapping({ index: adapter.indexName });
  assert.deepEqual(mapping.body[adapter.indexName].mappings.properties.profileCompletenessScore, { type: 'integer' });

  const v1IndexName = buildResumeSearchIndexName(adapter.indexPrefix, 'v1');
  const v1Exists = await adapter.client.indices.exists({ index: v1IndexName });
  assert.equal(v1Exists.body, true);

  const piiEmailResult = await search({
    keywords: [{ term: 'TEST.USER@Example.COM', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(piiEmailResult.items.length, 0);

  const piiPhoneResult = await search({
    keywords: [{ term: '+91 98765 43210', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(piiPhoneResult.items.length, 0);

  const safeFieldsResult = await search({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const safeCandidate = safeFieldsResult.items.find((item) => item.candidateId === 'candidate-safe-fields');
  assert.equal(Array.isArray(safeCandidate.normalizedSkills), true);
  assert.doesNotMatch(safeCandidate.currentTitle || '', /<mark>|<script>|salary|email|phone|address/i);
  assert.doesNotMatch(JSON.stringify(safeCandidate.normalizedSkills), /<mark>|<script>|salary|email|phone|address/i);
  assert.doesNotMatch(safeCandidate.educationSummary || '', /<mark>|<script>|salary|email|phone|address/i);
  assert.doesNotMatch(JSON.stringify(safeCandidate.certifications), /<mark>|<script>|salary|email|phone|address/i);
  assert.equal('visibilityClassification' in safeCandidate, false);
  assert.equal('sourceOrganisationId' in safeCandidate, false);
  assert.equal('currentSalaryNormalized' in safeCandidate, false);
  assert.equal('expectedSalaryNormalized' in safeCandidate, false);

  const mustItSales = await search({
    keywords: [
      { term: 'IT', mode: 'MUST' },
      { term: 'Sales', mode: 'MUST' },
      { term: 'SaaS', mode: 'SHOULD' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(mustItSales.items.map((item) => item.candidateId), ['candidate-it-sales-global']);

  const itDoesNotMatchOrdinaryIt = mustItSales.items.some((item) => item.candidateId === 'candidate-ordinary-it');
  assert.equal(itDoesNotMatchOrdinaryIt, false);

  const javaRanking = await search({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [{ term: 'Spring Boot', mode: 'SHOULD' }, { term: 'AWS', mode: 'SHOULD' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const javaRankingIds = javaRanking.items.map((item) => item.candidateId);
  assert.equal(javaRankingIds.includes('candidate-java-ranked'), true);
  assert.equal(javaRankingIds.includes('candidate-java-only'), true);
  assert.equal(javaRankingIds.indexOf('candidate-java-ranked') < javaRankingIds.indexOf('candidate-java-only'), true);

  const apex = await search({
    keywords: [{ term: 'PL/SQL', mode: 'MUST' }],
    phrases: [{ term: 'Oracle APEX', mode: 'MUST' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(apex.items.map((item) => item.candidateId), ['candidate-apex']);

  const taWithoutInternship = await search({
    keywords: [{ term: 'Talent Acquisition', mode: 'MUST' }],
    phrases: [{ term: 'Internship', mode: 'MUST_NOT' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const taWithoutInternshipIds = taWithoutInternship.items.map((item) => item.candidateId);
  assert.equal(taWithoutInternshipIds.includes('candidate-ta'), true);
  assert.equal(taWithoutInternshipIds.includes('candidate-internship'), false);

  const phraseMust = await search({
    keywords: [],
    phrases: [{ term: 'Business HR Partner', mode: 'MUST' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const phraseMustIds = phraseMust.items.map((item) => item.candidateId);
  assert.equal(phraseMustIds.includes('candidate-phrase'), true);
  assert.equal(phraseMust.items.some((item) => item.explanations.some((entry) => /Exact required phrase Business HR Partner matched/i.test(entry.text))), true);

  const exactConcepts = await Promise.all([
    search({ keywords: [{ term: 'C', mode: 'MUST' }], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null }, recruiterOrgA),
    search({ keywords: [{ term: 'C++', mode: 'MUST' }], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null }, recruiterOrgA),
    search({ keywords: [{ term: 'C#', mode: 'MUST' }], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null }, recruiterOrgA),
    search({ keywords: [{ term: '.NET', mode: 'MUST' }], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null }, recruiterOrgA),
    search({ keywords: [{ term: 'Node.js', mode: 'MUST' }], phrases: [], filters: {}, sort: 'RELEVANCE', pageSize: 10, cursor: null }, recruiterOrgA),
  ]);
  assert.deepEqual(exactConcepts[0].items.map((item) => item.candidateId), ['candidate-c']);
  assert.deepEqual(exactConcepts[1].items.map((item) => item.candidateId), ['candidate-cpp']);
  assert.deepEqual(exactConcepts[2].items.map((item) => item.candidateId), ['candidate-csharp']);
  assert.deepEqual(exactConcepts[3].items.map((item) => item.candidateId), ['candidate-csharp']);
  assert.deepEqual(exactConcepts[4].items.map((item) => item.candidateId), ['candidate-node']);

  const previousTitleAny = await search({
    keywords: [{ term: 'Recruitment', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: ['Oracle APEX Developer', 'Business HR Partner'],
      previousTitlesMatchMode: 'ANY',
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(previousTitleAny.items.map((item) => item.candidateId), ['candidate-prev-only-match']);

  const previousTitleAll = await search({
    keywords: [{ term: 'Recruitment', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: ['Oracle APEX Developer', 'Business HR Partner'],
      previousTitlesMatchMode: 'ALL',
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(previousTitleAll.items.map((item) => item.candidateId), ['candidate-prev-only-match']);

  const previousTitleOnly = await search({
    keywords: [],
    phrases: [],
    filters: {
      previousTitles: ['Oracle APEX Developer'],
      previousTitlesMatchMode: 'ANY',
      currentLocation: ['bengaluru'],
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(previousTitleOnly.items.map((item) => item.candidateId), ['candidate-prev-only-match']);

  const completenessMin = await search({
    keywords: [],
    phrases: [],
    filters: {
      profileCompletenessMin: 80,
      currentLocation: ['bengaluru'],
    },
    sort: 'RELEVANCE',
    pageSize: 20,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(completenessMin.items.every((item) => ['candidate-redacted', 'candidate-it-sales-global', 'candidate-java-ranked', 'candidate-ta', 'candidate-salary-visible', 'candidate-safe-fields'].includes(item.candidateId)), true);

  const completenessMax = await search({
    keywords: [],
    phrases: [],
    filters: {
      profileCompletenessMax: 50,
      currentLocation: ['bengaluru'],
    },
    sort: 'RELEVANCE',
    pageSize: 20,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(completenessMax.items.some((item) => item.candidateId === 'candidate-ordinary-it'), true);

  const experienceDesc = await search({
    keywords: [{ term: 'Python', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'EXPERIENCE_DESC',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(experienceDesc.items.map((item) => item.candidateId), ['candidate-salary-visible', 'candidate-salary-hidden']);

  const experienceAsc = await search({
    keywords: [{ term: 'Python', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'EXPERIENCE_ASC',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(experienceAsc.items.map((item) => item.candidateId), ['candidate-salary-hidden', 'candidate-salary-visible']);

  const cursorPageOne = await search({
    keywords: [{ term: 'Search', mode: 'MUST' }],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'EXPERIENCE_DESC',
    pageSize: 2,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(cursorPageOne.items.length, 2);
  assert.equal(Boolean(cursorPageOne.meta.nextCursor), true);

  const cursorPageTwo = await search({
    keywords: [{ term: 'Search', mode: 'MUST' }],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'EXPERIENCE_DESC',
    pageSize: 2,
    cursor: cursorPageOne.meta.nextCursor,
  }, recruiterOrgA);
  assert.deepEqual(cursorPageOne.items.concat(cursorPageTwo.items).map((item) => item.candidateId), [
    'candidate-exp-tie-a',
    'candidate-exp-tie-b',
    'candidate-exp-tie-c',
  ]);

  await assert.rejects(() => search({
    keywords: [{ term: 'Search', mode: 'MUST' }],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'EXPERIENCE_DESC',
    pageSize: 2,
    cursor: `${cursorPageOne.meta.nextCursor}tampered`,
  }, recruiterOrgA), /invalid/i);

  await assert.rejects(() => search({
    keywords: [{ term: 'Different', mode: 'MUST' }],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'EXPERIENCE_DESC',
    pageSize: 2,
    cursor: cursorPageOne.meta.nextCursor,
  }, recruiterOrgA), /does not match this query/i);

  const salaryAuthorized = await search({
    keywords: [{ term: 'Python', mode: 'MUST' }],
    phrases: [],
    filters: {
      salaryMin: 2500000,
      salaryMax: 3300000,
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(salaryAuthorized.items.map((item) => item.candidateId), ['candidate-salary-visible']);
  assert.equal('currentSalaryNormalized' in salaryAuthorized.items[0], false);
  assert.equal('expectedSalaryNormalized' in salaryAuthorized.items[0], false);

  const orgAView = await search({
    keywords: [{ term: 'Sales', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(orgAView.items.some((item) => item.candidateId === 'candidate-private-org-b'), false);

  const orgBView = await search({
    keywords: [{ term: 'Sales', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgB);
  assert.equal(orgBView.items.some((item) => item.candidateId === 'candidate-private-org-b'), true);
  assert.equal(orgBView.items.some((item) => item.candidateId === 'candidate-archived'), false);

  const visibilityFilter = buildResumeSearchVisibilityFilter({
    actorUser: recruiterOrgA,
    organisationId: 'org-a',
  });
  assert.match(JSON.stringify(visibilityFilter), /GLOBAL_RECRUITER_DATABASE/);
  assert.match(JSON.stringify(visibilityFilter), /ORGANISATION_PRIVATE/);
});
