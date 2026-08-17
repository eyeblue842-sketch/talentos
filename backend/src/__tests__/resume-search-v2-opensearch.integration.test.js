import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

let OpenSearchResumeSearchAdapter;
let compileResumeSearchV2Query;
let createSignedSearchCursor;
let parseSignedSearchCursor;
let buildResumeSearchVisibilityFilter;
let buildResumeSearchDocument;
let buildResumeSearchIndexMapping;
let env;
let adapter;

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
    certifications: overrides.certifications || [],
    languages: overrides.languages || ['english'],
    currentLocation: overrides.currentLocation || 'bengaluru',
    preferredLocations: overrides.preferredLocations || [],
    noticePeriodDays: overrides.noticePeriodDays ?? 30,
    salarySearchable: overrides.salarySearchable ?? false,
    currentSalaryNormalized: overrides.currentSalaryNormalized ?? null,
    expectedSalaryNormalized: overrides.expectedSalaryNormalized ?? null,
    parsingConfidence: overrides.parsingConfidence ?? 0.9,
    reviewRequired: overrides.reviewRequired ?? false,
    resumeUpdatedAt: overrides.resumeUpdatedAt || '2026-08-17T10:00:00.000Z',
    profileUpdatedAt: overrides.profileUpdatedAt || '2026-08-17T10:00:00.000Z',
    sourceVersion: overrides.sourceVersion || `v:${overrides.candidateId}`,
    indexSchemaVersion: 'v1',
  };
}

async function refreshAll() {
  await adapter.client.indices.refresh({ index: '*' });
}

function applyAccess(searchRequest, actorUser) {
  return {
    ...searchRequest,
    query: {
      bool: {
        ...searchRequest.query.bool,
        filter: [
          ...(searchRequest.query.bool.filter || []),
          buildResumeSearchVisibilityFilter({
            actorUser,
            organisationId: actorUser?.activeMembership?.organisationId || null,
          }),
        ],
      },
    },
  };
}

async function search(payload, actorUser, options = {}) {
  const compiled = compileResumeSearchV2Query(payload, {
    allowSalaryFilters: options.allowSalaryFilters ?? false,
  });
  const searchRequest = applyAccess(compiled.searchRequest, actorUser);
  const cursor = options.cursor || payload.cursor || null;
  const parsedCursor = cursor ? parseSignedSearchCursor(cursor, compiled.queryFingerprint) : null;
  const pitId = parsedCursor?.pitId || await adapter.openPointInTime();
  const body = await adapter.searchResumes({
    searchRequest,
    pitId,
    searchAfter: parsedCursor?.sa || null,
  });
  const hits = body.hits?.hits || [];
  const lastSort = hits.length ? hits[hits.length - 1].sort : null;
  const nextCursor = lastSort ? createSignedSearchCursor({
    pitId,
    searchAfter: lastSort,
    queryFingerprint: compiled.queryFingerprint,
  }) : null;
  if (!nextCursor) {
    await adapter.closePointInTime(pitId);
  }
  return { compiled, body, nextCursor, pitId };
}

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ OpenSearchResumeSearchAdapter } = await import('../services/resumeSearchV2/openSearchAdapter.js'));
  ({ compileResumeSearchV2Query } = await import('../services/resumeSearchV2/queryCompiler.js'));
  ({ createSignedSearchCursor, parseSignedSearchCursor } = await import('../services/resumeSearchV2/cursor.js'));
  ({ buildResumeSearchVisibilityFilter } = await import('../services/resumeSearchV2/visibility.js'));
  ({ buildResumeSearchDocument } = await import('../services/resumeSearchV2/documentBuilder.js'));
  ({ buildResumeSearchIndexMapping } = await import('../services/resumeSearchV2/mapping.js'));
  env.openSearchCursorSecret = 'resume-search-v2-opensearch-secret';

  if (!runIntegration) return;
  adapter = new OpenSearchResumeSearchAdapter({
    node: process.env.OPENSEARCH_NODE || 'http://127.0.0.1:9201',
    indexPrefix: `careeriz-resume-search-it-${Date.now()}`,
  });

  await adapter.ensureIndexVersion();

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
    certificationEntries: [{ name: 'AWS Certified Solutions Architect' }],
    languageEntries: [{ language: 'English' }],
    parserMetadata: {},
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
      totalExperienceMonths: 96,
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
      totalExperienceMonths: 72,
    }),
    baseDoc({
      candidateId: 'candidate-java-only',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Java Engineer',
      normalizedSkills: ['Java'],
      projectsText: 'Built Java services',
      totalExperienceMonths: 60,
    }),
    baseDoc({
      candidateId: 'candidate-apex',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Oracle APEX Developer',
      normalizedSkills: ['Oracle APEX', 'PL/SQL'],
      projectsText: 'Oracle Application Express and PL/SQL modernization',
    }),
    baseDoc({
      candidateId: 'candidate-ta',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Talent Acquisition Partner',
      normalizedSkills: ['Talent Acquisition', 'Recruitment'],
      employmentHistoryText: 'Talent Acquisition for enterprise hiring',
    }),
    baseDoc({
      candidateId: 'candidate-internship',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Talent Acquisition Internship',
      normalizedSkills: ['Talent Acquisition'],
      employmentHistoryText: 'Internship in talent acquisition',
    }),
    baseDoc({
      candidateId: 'candidate-c',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Embedded C Developer',
      normalizedSkills: ['C'],
      projectsText: 'C firmware development',
    }),
    baseDoc({
      candidateId: 'candidate-cpp',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'C++ Engineer',
      normalizedSkills: ['C++'],
      projectsText: 'Modern C++ systems programming',
    }),
    baseDoc({
      candidateId: 'candidate-csharp',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'C# Engineer',
      normalizedSkills: ['C#', '.NET'],
      projectsText: '.NET backend services',
    }),
    baseDoc({
      candidateId: 'candidate-node',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Node.js Engineer',
      normalizedSkills: ['Node.js'],
      projectsText: 'Node.js APIs and services',
    }),
    baseDoc({
      candidateId: 'candidate-phrase',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Business HR Partner',
      normalizedSkills: ['Human Resources'],
      employmentHistoryText: 'Business HR Partner for enterprise operations',
    }),
    baseDoc({
      candidateId: 'candidate-private-org-b',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'ORGANISATION_PRIVATE',
      currentTitle: 'Private Sales Manager',
      normalizedSkills: ['Sales'],
      employmentHistoryText: 'Private organisation-only resume',
      profileUpdatedAt: '2026-08-17T10:03:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-private-org-a',
      sourceOrganisationId: 'org-a',
      visibilityClassification: 'ORGANISATION_PRIVATE',
      currentTitle: 'Private IT Recruiter',
      normalizedSkills: ['IT', 'Recruitment'],
      employmentHistoryText: 'Private org A resume',
    }),
    baseDoc({
      candidateId: 'candidate-public',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'CANDIDATE_PUBLIC',
      currentTitle: 'Public QA Engineer',
      normalizedSkills: ['QA'],
      employmentHistoryText: 'Public candidate profile',
      profileUpdatedAt: '2026-08-17T10:02:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-cursor-1',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor One',
      normalizedSkills: ['Search'],
      currentLocation: 'cursor-city',
      profileUpdatedAt: '2026-08-17T10:11:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-cursor-2',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor Two',
      normalizedSkills: ['Search'],
      currentLocation: 'cursor-city',
      profileUpdatedAt: '2026-08-17T10:10:00.000Z',
    }),
    baseDoc({
      candidateId: 'candidate-cursor-3',
      sourceOrganisationId: 'org-b',
      visibilityClassification: 'GLOBAL_RECRUITER_DATABASE',
      currentTitle: 'Cursor Three',
      normalizedSkills: ['Search'],
      currentLocation: 'cursor-city',
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
    }),
  ]);

  await refreshAll();
});

after(async () => {
  if (!adapter?.client) return;
  await adapter.client.indices.delete({ index: `${adapter.indexPrefix}-*` }).catch(() => {});
});

integrationTest('real OpenSearch integration covers privacy, visibility, ranking, filters, pagination, and alias switching', async () => {
  const recruiterOrgA = {
    role: 'RECRUITER',
    activeMembership: { organisationId: 'org-a', role: 'RECRUITER' },
  };
  const recruiterOrgB = {
    role: 'RECRUITER',
    activeMembership: { organisationId: 'org-b', role: 'RECRUITER' },
  };

  const piiKeywordResult = await search({
    keywords: [{ term: 'TEST.USER@Example.COM', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(piiKeywordResult.body.hits.hits.length, 0);

  const piiPhoneResult = await search({
    keywords: [{ term: '+91 98765 43210', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(piiPhoneResult.body.hits.hits.length, 0);

  const keywordResult = await search({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const redactedSource = keywordResult.body.hits.hits.find((hit) => hit._id === 'candidate:candidate-redacted')._source;
  assert.equal('resumeText' in redactedSource, false);
  assert.doesNotMatch(JSON.stringify(redactedSource), /test\.user@example\.com/i);
  assert.doesNotMatch(JSON.stringify(redactedSource), /98765 43210/);
  assert.doesNotMatch(JSON.stringify(redactedSource), /560001/);

  const highlightResult = await search({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const redactedHit = highlightResult.body.hits.hits.find((hit) => hit._id === 'candidate:candidate-redacted');
  assert.doesNotMatch(JSON.stringify(redactedHit.highlight || {}), /test\.user@example\.com/i);
  assert.doesNotMatch(JSON.stringify(redactedHit.highlight || {}), /98765 43210/);
  assert.doesNotMatch(JSON.stringify(redactedHit.highlight || {}), /560001/);

  const itSales = await search({
    keywords: [
      { term: 'IT', mode: 'MUST' },
      { term: 'Sales', mode: 'MUST' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(itSales.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-it-sales-global']);

  const javaRanked = await search({
    keywords: [
      { term: 'Java', mode: 'MUST' },
      { term: 'Spring Boot', mode: 'SHOULD' },
      { term: 'AWS', mode: 'SHOULD' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const javaIds = javaRanked.body.hits.hits.map((hit) => hit._id);
  assert.equal(javaIds.indexOf('candidate:candidate-java-only') > 0, true);
  assert.equal(javaIds.slice(0, 2).includes('candidate:candidate-java-ranked'), true);
  assert.equal(javaIds.slice(0, 2).includes('candidate:candidate-redacted'), true);

  const apex = await search({
    keywords: [
      { term: 'Oracle APEX', mode: 'MUST' },
      { term: 'PL/SQL', mode: 'MUST' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(apex.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-apex']);

  const talentAcquisition = await search({
    keywords: [
      { term: 'Talent Acquisition', mode: 'MUST' },
      { term: 'Internship', mode: 'MUST_NOT' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(talentAcquisition.body.hits.hits.map((hit) => hit._id).includes('candidate:candidate-ta'), true);
  assert.equal(talentAcquisition.body.hits.hits.map((hit) => hit._id).includes('candidate:candidate-internship'), false);

  const exactC = await search({
    keywords: [{ term: 'C', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(exactC.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-c']);

  const exactCpp = await search({
    keywords: [{ term: 'C++', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(exactCpp.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-cpp']);

  const exactCsharp = await search({
    keywords: [{ term: 'C#', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(exactCsharp.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-csharp']);

  const dotNet = await search({
    keywords: [{ term: '.NET', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(dotNet.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-csharp']);

  const nodeJs = await search({
    keywords: [{ term: 'Node.js', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(nodeJs.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-node']);

  const businessHr = await search({
    keywords: [],
    phrases: ['Business HR Partner'],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.deepEqual(businessHr.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-phrase']);

  const synonymQuery = await search({
    keywords: [{ term: 'Recruitment', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(synonymQuery.body.hits.hits.map((hit) => hit._id).includes('candidate:candidate-ta'), true);

  const fuzzyQuery = await search({
    keywords: [
      { term: 'Java', mode: 'MUST' },
      { term: 'Sprng Boot', mode: 'SHOULD' },
    ],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(fuzzyQuery.body.hits.hits.map((hit) => hit._id).includes('candidate:candidate-java-ranked'), true);

  const filterOnly = await search({
    keywords: [],
    phrases: [],
    filters: {
      currentLocation: ['hyderabad'],
      minExperienceMonths: 72,
      noticePeriodDaysMax: 60,
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA);
  const filterOnlyIds = filterOnly.body.hits.hits.map((hit) => hit._id);
  assert.equal(filterOnlyIds.includes('candidate:candidate-salary-visible'), true);
  assert.equal(filterOnlyIds.includes('candidate:candidate-salary-hidden'), true);

  const salaryAuthorized = await search({
    keywords: [],
    phrases: [],
    filters: {
      currentLocation: ['hyderabad'],
      salaryMin: 2500000,
      salaryMax: 3300000,
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }, recruiterOrgA, { allowSalaryFilters: true });
  assert.deepEqual(salaryAuthorized.body.hits.hits.map((hit) => hit._id), ['candidate:candidate-salary-visible']);

  const orgASearch = await search({
    keywords: [{ term: 'Sales', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 20,
    cursor: null,
  }, recruiterOrgA);
  const orgAIds = orgASearch.body.hits.hits.map((hit) => hit._id);
  assert.equal(orgAIds.includes('candidate:candidate-private-org-b'), false);
  assert.equal(orgAIds.includes('candidate:candidate-private-org-a'), false);
  assert.equal(orgAIds.includes('candidate:candidate-it-sales-global'), true);

  const orgBSearch = await search({
    keywords: [{ term: 'Sales', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 20,
    cursor: null,
  }, recruiterOrgB);
  const orgBIds = orgBSearch.body.hits.hits.map((hit) => hit._id);
  assert.equal(orgBIds.includes('candidate:candidate-private-org-b'), true);
  assert.equal(orgBIds.includes('candidate:candidate-private-org-a'), false);
  assert.equal(orgBIds.includes('candidate:candidate-archived'), false);
  assert.doesNotMatch(JSON.stringify(orgBSearch.body.hits.hits), /notes|ratings|applications|interviews|offers/i);

  const firstPage = await search({
    keywords: [],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'PROFILE_UPDATED_AT_DESC',
    pageSize: 2,
    cursor: null,
  }, recruiterOrgB);
  assert.equal(Boolean(firstPage.nextCursor), true);
  const secondPage = await search({
    keywords: [],
    phrases: [],
    filters: { currentLocation: ['cursor-city'] },
    sort: 'PROFILE_UPDATED_AT_DESC',
    pageSize: 2,
    cursor: firstPage.nextCursor,
  }, recruiterOrgB);
  assert.equal(secondPage.body.hits.hits.length >= 1, true);
  assert.notDeepEqual(
    firstPage.body.hits.hits.map((hit) => hit._id),
    secondPage.body.hits.hits.map((hit) => hit._id),
  );
  assert.throws(() => parseSignedSearchCursor(`${firstPage.nextCursor}x`, firstPage.compiled.queryFingerprint), /invalid/i);
  assert.throws(() => parseSignedSearchCursor(firstPage.nextCursor, 'different-query'), /does not match/i);
  await adapter.closePointInTime(parseSignedSearchCursor(firstPage.nextCursor, firstPage.compiled.queryFingerprint).pitId);

  const healthBefore = await adapter.getIndexHealth();
  const alternateIndex = `${adapter.indexPrefix}-v1-alt`;
  await adapter.client.indices.create({ index: alternateIndex, body: buildResumeSearchIndexMapping() });
  await adapter.switchAliases({ indexName: alternateIndex });
  const aliasState = await adapter.client.indices.getAlias({ index: `${adapter.indexPrefix}-*` });
  assert.equal(Boolean(healthBefore), true);
  assert.equal(Object.keys(aliasState.body[alternateIndex].aliases || {}).includes('careeriz-resume-search-write'), true);
  await adapter.switchAliases({ indexName: adapter.indexName });

  await adapter.deleteResumeDocument('candidate:candidate-private-org-a');
  await refreshAll();
  const deleted = await search({
    keywords: [{ term: 'Recruitment', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 20,
    cursor: null,
  }, recruiterOrgA);
  assert.equal(deleted.body.hits.hits.some((hit) => hit._id === 'candidate:candidate-private-org-a'), false);
});
