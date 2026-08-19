import test, { before } from 'node:test';
import assert from 'node:assert/strict';

let env;
let compileResumeSearchV2Query;
let buildResumeSearchDocument;
let createSignedSearchCursor;
let parseSignedSearchCursor;
let sanitizeResumeSearchText;
let buildResumeSearchVisibilityFilter;
let resolveResumeVisibilityClassification;
let calculateResumeSearchProfileCompleteness;
let RESUME_SEARCH_INDEX_SCHEMA_VERSION;
let buildResumeSearchIndexMapping;
let buildResumeSearchIndexMappingV1;

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ compileResumeSearchV2Query } = await import('../services/resumeSearchV2/queryCompiler.js'));
  ({ buildResumeSearchDocument } = await import('../services/resumeSearchV2/documentBuilder.js'));
  ({ createSignedSearchCursor, parseSignedSearchCursor } = await import('../services/resumeSearchV2/cursor.js'));
  ({ sanitizeResumeSearchText } = await import('../services/resumeSearchV2/privacy.js'));
  ({
    buildResumeSearchVisibilityFilter,
    resolveResumeVisibilityClassification,
  } = await import('../services/resumeSearchV2/visibility.js'));
  ({ calculateResumeSearchProfileCompleteness } = await import('../services/resumeSearchV2/profileCompleteness.js'));
  ({
    RESUME_SEARCH_INDEX_SCHEMA_VERSION,
    buildResumeSearchIndexMapping,
    buildResumeSearchIndexMappingV1,
  } = await import('../services/resumeSearchV2/mapping.js'));
  env.openSearchCursorSecret = 'resume-search-v2-test-secret';
});

test('query compiler enforces MUST/SHOULD/MUST_NOT semantics for keywords and phrases without query_string', () => {
  const compiled = compileResumeSearchV2Query({
    keywords: [
      { term: 'IT', mode: 'MUST' },
      { term: 'Sales', mode: 'MUST' },
      { term: 'SaaS', mode: 'SHOULD' },
      { term: 'Internship', mode: 'MUST_NOT' },
    ],
    phrases: [
      { term: 'Business HR Partner', mode: 'MUST' },
      { term: 'Campus Hiring', mode: 'SHOULD' },
      { term: 'Summer Internship', mode: 'MUST_NOT' },
    ],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 25,
    cursor: null,
  });

  assert.equal(compiled.searchRequest.query.bool.must.length, 3);
  assert.equal(compiled.searchRequest.query.bool.should.length, 2);
  assert.equal(compiled.searchRequest.query.bool.must_not.length, 2);
  assert.equal(compiled.searchRequest.query.bool.minimum_should_match, 0);
  assert.equal('query_string' in JSON.parse(JSON.stringify(compiled.searchRequest.query)), false);
});

test('query compiler requires one optional match when only SHOULD keywords and phrases are present', () => {
  const compiled = compileResumeSearchV2Query({
    keywords: [
      { term: 'Java', mode: 'SHOULD' },
      { term: 'AWS', mode: 'SHOULD' },
    ],
    phrases: [{ term: 'Spring Boot', mode: 'SHOULD' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  });

  assert.equal(compiled.searchRequest.query.bool.must.length, 0);
  assert.equal(compiled.searchRequest.query.bool.minimum_should_match, 1);
});

test('query compiler supports experience sorts with deterministic tie breakers', () => {
  const descending = compileResumeSearchV2Query({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'EXPERIENCE_DESC',
    pageSize: 10,
    cursor: null,
  });
  const ascending = compileResumeSearchV2Query({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {},
    sort: 'EXPERIENCE_ASC',
    pageSize: 10,
    cursor: null,
  });

  assert.deepEqual(descending.searchRequest.sort[0], { totalExperienceMonths: { order: 'desc', missing: '_last' } });
  assert.deepEqual(ascending.searchRequest.sort[0], { totalExperienceMonths: { order: 'asc', missing: '_last' } });
  assert.deepEqual(descending.searchRequest.sort.at(-1), { documentId: 'asc' });
  assert.deepEqual(ascending.searchRequest.sort.at(-1), { documentId: 'asc' });
});

test('query compiler supports previous title ANY and ALL semantics without current-title leakage', () => {
  const anyCompiled = compileResumeSearchV2Query({
    keywords: [{ term: 'Recruiter', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: ['Oracle APEX Developer', 'Business HR Partner'],
      previousTitlesMatchMode: 'ANY',
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  });
  const allCompiled = compileResumeSearchV2Query({
    keywords: [{ term: 'Recruiter', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: ['Oracle APEX Developer', 'Business HR Partner'],
      previousTitlesMatchMode: 'ALL',
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  });

  const serializedAny = JSON.stringify(anyCompiled.searchRequest.query.bool.filter);
  const serializedAll = JSON.stringify(allCompiled.searchRequest.query.bool.filter);
  assert.match(serializedAny, /previousTitles/);
  assert.match(serializedAll, /previousTitles/);
  assert.doesNotMatch(serializedAny, /currentTitle\.raw/);
  assert.doesNotMatch(serializedAll, /currentTitle\.raw/);
  assert.match(serializedAny, /minimum_should_match/);
  assert.match(serializedAll, /"must"/);
});

test('query compiler validates profile completeness ranges and schema bounds', () => {
  const compiled = compileResumeSearchV2Query({
    keywords: [],
    phrases: [],
    filters: {
      profileCompletenessMin: 40,
      profileCompletenessMax: 80,
      currentLocation: ['Bengaluru'],
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  });

  assert.match(JSON.stringify(compiled.searchRequest.query.bool.filter), /profileCompletenessScore/);

  assert.throws(() => compileResumeSearchV2Query({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: { profileCompletenessMin: -1 },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }), /greater than or equal to 0/i);

  assert.throws(() => compileResumeSearchV2Query({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: { profileCompletenessMax: 101 },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }), /less than or equal to 100/i);

  assert.throws(() => compileResumeSearchV2Query({
    keywords: [{ term: 'Java', mode: 'MUST' }],
    phrases: [],
    filters: {
      profileCompletenessMin: 90,
      profileCompletenessMax: 20,
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }), /profileCompletenessMin cannot exceed profileCompletenessMax/i);
});

test('query compiler rejects invalid previous-title match mode and excessive previous-title filters', () => {
  assert.throws(() => compileResumeSearchV2Query({
    keywords: [{ term: 'Recruiter', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: ['Business HR Partner'],
      previousTitlesMatchMode: 'INVALID',
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }), /invalid enum value/i);

  assert.throws(() => compileResumeSearchV2Query({
    keywords: [{ term: 'Recruiter', mode: 'MUST' }],
    phrases: [],
    filters: {
      previousTitles: Array.from({ length: 21 }, (_, index) => `Previous title ${index}`),
    },
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  }), /Array must contain at most 20 element/i);
});

test('query compiler keeps abbreviation matching constrained and exact skill matching available', () => {
  const compiled = compileResumeSearchV2Query({
    keywords: [
      { term: 'IT', mode: 'MUST' },
      { term: 'C++', mode: 'SHOULD' },
      { term: 'C#', mode: 'SHOULD' },
      { term: 'PL/SQL', mode: 'SHOULD' },
      { term: 'Node.js', mode: 'SHOULD' },
    ],
    phrases: [{ term: 'Business HR Partner', mode: 'SHOULD' }],
    filters: {},
    sort: 'RELEVANCE',
    pageSize: 10,
    cursor: null,
  });

  const serialized = JSON.stringify(compiled.searchRequest.query);
  assert.match(serialized, /normalizedSkills\.raw/);
  assert.match(serialized, /currentTitle\.raw/);
  assert.match(serialized, /regexp/);
  assert.doesNotMatch(serialized, /resumeText/);
  assert.match(serialized, /Business HR Partner/);
});

test('privacy sanitizer redacts contact data while preserving professional numeric content', () => {
  const sanitized = sanitizeResumeSearchText([
    'Email: TEST.USER@Example.COM',
    'Phone: +91 98765 43210',
    'Alt: +1-202-555-0188',
    'LinkedIn: https://www.linkedin.com/in/test-user-123',
    'Address: Flat 12, MG Road, Bengaluru 560001, India',
    'Experience: 8 years, Notice: 30 days, Current CTC: 24 LPA',
  ].join('\n'));

  assert.doesNotMatch(sanitized, /test\.user@example\.com/i);
  assert.doesNotMatch(sanitized, /98765 43210/);
  assert.doesNotMatch(sanitized, /202-555-0188/);
  assert.doesNotMatch(sanitized, /linkedin\.com/i);
  assert.doesNotMatch(sanitized, /560001/);
  assert.match(sanitized, /\[redacted-email\]/);
  assert.match(sanitized, /\[redacted-phone\]/);
  assert.match(sanitized, /\[redacted-contact-url\]/);
  assert.match(sanitized, /\[redacted-address\]/);
  assert.match(sanitized, /8 years/i);
  assert.match(sanitized, /30 days/i);
  assert.match(sanitized, /24 LPA/i);
});

test('document builder strips contact data, omits resumeText, and produces deterministic safe card fields in schema v2', () => {
  const candidate = {
    id: 'candidate-1',
    organisationId: 'org-1',
    fullName: 'Asha Recruiter',
    email: 'private@example.com',
    phoneNumber: '+91 99999 11111',
    currentTitle: 'Talent Acquisition Lead',
    currentEmployer: 'Careeriz',
    location: 'Bengaluru',
    preferredLocations: ['Mumbai'],
    totalExperience: 8,
    salaryVisibleToRecruiters: false,
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'RECRUITERS_ONLY',
    skills: ['Node.js', 'JavaScript', '<mark>Sales</mark>', 'JavaScript'],
    languageEntries: [{ language: 'English' }],
    educationEntries: [{
      degree: 'MBA',
      institution: 'City University',
      specialization: 'Human Resources',
    }],
    certificationEntries: [{ name: 'AWS Certified Solutions Architect' }, { name: 'AWS Certified Solutions Architect' }],
    experienceEntries: [{
      title: 'Talent Acquisition Lead',
      company: 'Careeriz',
      isCurrent: true,
      summary: 'Contact me at PRIVATE@example.com or +91 99999 11111',
    }],
    projectEntries: [{
      projectName: 'Portal',
      summary: 'See https://www.linkedin.com/in/test-user-123',
    }],
    parserMetadata: {},
    summary: 'Experienced recruiter',
    profileStatus: 'ACTIVE',
    source: 'BULK_IMPORT',
    updatedAt: new Date('2026-08-17T10:00:00.000Z'),
  };
  const resume = {
    id: 'resume-1',
    parsedText: 'Private raw resume text with private@example.com and Flat 12, MG Road, Bengaluru 560001',
    updatedAt: new Date('2026-08-17T10:01:00.000Z'),
  };

  const document = buildResumeSearchDocument(candidate, resume);

  assert.equal(document.indexSchemaVersion, RESUME_SEARCH_INDEX_SCHEMA_VERSION);
  assert.equal(document.salarySearchable, false);
  assert.equal(document.currentSalaryNormalized, null);
  assert.equal(document.expectedSalaryNormalized, null);
  assert.equal(document.resumeSource, 'BULK_IMPORT');
  assert.equal(document.visibilityClassification, 'GLOBAL_RECRUITER_DATABASE');
  assert.equal(document.searchableProfile, true);
  assert.equal(document.profileCompletenessScore, 90);
  assert.equal('email' in document, false);
  assert.equal('phoneNumber' in document, false);
  assert.equal('resumeText' in document, false);
  assert.deepEqual(document.normalizedSkills, ['JavaScript', 'Node.js', 'Sales']);
  assert.equal(document.educationSummary, 'MBA, Human Resources, City University');
  assert.deepEqual(document.certifications, ['AWS Certified Solutions Architect']);
  assert.doesNotMatch(document.employmentHistoryText, /private@example\.com/i);
  assert.doesNotMatch(document.employmentHistoryText, /99999 11111/);
  assert.doesNotMatch(document.projectsText, /linkedin\.com/i);
});

test('profile completeness scorer is deterministic at 0 and 100 boundaries', () => {
  assert.equal(calculateResumeSearchProfileCompleteness({}).score, 0);

  const full = calculateResumeSearchProfileCompleteness({
    currentTitle: 'Senior Recruiter',
    headline: 'Senior Recruiter',
    skills: ['Java', 'Spring Boot'],
    experienceEntries: [{ title: 'Senior Recruiter', company: 'Careeriz', summary: 'Owned hiring' }],
    totalExperience: 6,
    educationEntries: [{ degree: 'MBA', institution: 'State University' }],
    location: 'Bengaluru',
    certificationEntries: [{ name: 'AWS Certified Solutions Architect' }],
    languageEntries: [{ language: 'English' }],
    summary: 'Strong recruiter profile',
  });
  assert.equal(full.score, 100);
});

test('mapping exports keep v1 rebuildable while v2 adds profileCompletenessScore', () => {
  const v1 = buildResumeSearchIndexMappingV1();
  const v2 = buildResumeSearchIndexMapping();

  assert.equal(v1.mappings.properties.profileCompletenessScore, undefined);
  assert.deepEqual(v2.mappings.properties.profileCompletenessScore, { type: 'integer' });
});

test('visibility helpers distinguish global, private, public, and not-searchable records', () => {
  assert.equal(resolveResumeVisibilityClassification({
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'RECRUITERS_ONLY',
    profileStatus: 'ACTIVE',
  }, { status: 'ACTIVE' }), 'GLOBAL_RECRUITER_DATABASE');

  assert.equal(resolveResumeVisibilityClassification({
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'PRIVATE',
    profileStatus: 'ACTIVE',
  }, { status: 'ACTIVE' }), 'ORGANISATION_PRIVATE');

  assert.equal(resolveResumeVisibilityClassification({
    searchableProfile: true,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'PUBLIC',
    profileStatus: 'ACTIVE',
  }, { status: 'ACTIVE' }), 'CANDIDATE_PUBLIC');

  assert.equal(resolveResumeVisibilityClassification({
    searchableProfile: false,
    resumeVisibleToRecruiters: true,
    profileVisibility: 'RECRUITERS_ONLY',
    profileStatus: 'ACTIVE',
  }, { status: 'ACTIVE' }), 'NOT_SEARCHABLE');

  const filter = buildResumeSearchVisibilityFilter({
    actorUser: { role: 'RECRUITER' },
    organisationId: 'org-a',
  });
  const filterJson = JSON.stringify(filter);
  assert.match(filterJson, /GLOBAL_RECRUITER_DATABASE/);
  assert.match(filterJson, /ORGANISATION_PRIVATE/);
  assert.match(filterJson, /org-a/);
  assert.match(filterJson, /CANDIDATE_PUBLIC/);
});

test('signed cursor rejects tampering, expiry, and query mismatch', () => {
  const queryFingerprint = 'abc123';
  const cursor = createSignedSearchCursor({
    pitId: 'pit-1',
    searchAfter: ['10', 'candidate-1'],
    queryFingerprint,
    ttlMs: 5,
  });

  const parsed = parseSignedSearchCursor(cursor, queryFingerprint);
  assert.equal(parsed.pitId, 'pit-1');

  assert.throws(() => parseSignedSearchCursor(`${cursor}x`, queryFingerprint), /invalid/i);
  assert.throws(() => parseSignedSearchCursor(cursor, 'different-query'), /does not match/i);

  const expiredCursor = createSignedSearchCursor({
    pitId: 'pit-2',
    searchAfter: ['20'],
    queryFingerprint,
    ttlMs: -1,
  });
  assert.throws(() => parseSignedSearchCursor(expiredCursor, queryFingerprint), /expired/i);
});
