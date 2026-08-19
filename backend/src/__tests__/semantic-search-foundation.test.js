import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let parseSearchQuery;
let extractSearchIntent;
let searchSemanticCandidates;
let previewSemanticSearch;
let getSemanticSearchIntent;

let state;

function now() {
  return new Date('2026-07-29T10:00:00.000Z');
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function seedState() {
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'org-2', name: 'Other', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'recruiter-1', role: 'RECRUITER', email: 'recruiter@acme.com', isActive: true, sessionVersion: 0 },
      { id: 'interviewer-1', role: 'INTERVIEWER', email: 'interviewer@acme.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'interviewer-1', role: 'INTERVIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.semantic_search', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-2', organisationId: 'org-1', key: 'intelligence.semantic_search_expansion', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-3', organisationId: 'org-1', key: 'intelligence.search_history', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    candidates: [
      {
        id: 'c000000000000000000000001',
        organisationId: 'org-1',
        fullName: 'Asha Backend',
        headline: 'Senior Backend Engineer',
        currentTitle: 'Senior Backend Engineer',
        location: 'Bangalore',
        totalExperience: 7,
        skills: ['Java', 'Spring Boot', 'AWS'],
        currentEmployer: 'Acme Labs',
        noticePeriodDays: 30,
        preferredIndustries: ['Fintech'],
        latestResumeAssetId: 'resume-1',
        updatedAt: now(),
        createdAt: now(),
      },
      {
        id: 'c000000000000000000000002',
        organisationId: 'org-1',
        fullName: 'Riya Frontend',
        headline: 'Frontend Engineer',
        currentTitle: 'Frontend Engineer',
        location: 'Chennai',
        totalExperience: 4,
        skills: ['React', 'TypeScript'],
        currentEmployer: 'UX Labs',
        noticePeriodDays: 15,
        preferredIndustries: ['SaaS'],
        latestResumeAssetId: 'resume-2',
        updatedAt: now(),
        createdAt: now(),
      },
      {
        id: 'c000000000000000000000003',
        organisationId: 'org-2',
        fullName: 'Hidden Candidate',
        headline: 'Senior Backend Engineer',
        currentTitle: 'Senior Backend Engineer',
        location: 'Bangalore',
        totalExperience: 8,
        skills: ['Java', 'Spring Boot', 'AWS'],
        currentEmployer: 'Other Corp',
        noticePeriodDays: 30,
        latestResumeAssetId: 'resume-3',
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    applications: [
      { id: 'app-1', organisationId: 'org-1', candidateId: 'c000000000000000000000001', currentStage: 'APPLIED', statusLabel: 'Applied', updatedAt: now() },
    ],
    savedCandidates: [],
    candidateIntelligenceStates: [
      {
        id: 'cis-1',
        candidateId: 'c000000000000000000000001',
        kind: 'PROFILE_OVERVIEW',
        latestResultId: 'result-1',
        latestResult: {
          normalizedOutput: {
            skills: {
              normalized: [{ name: 'Spring Boot' }, { name: 'AWS' }],
            },
          },
        },
      },
    ],
    jobs: [
      {
        id: 'j000000000000000000000001',
        organisationId: 'org-1',
        title: 'Senior Backend Engineer',
        location: 'Bangalore',
        skillsRequired: ['Java', 'Spring Boot', 'AWS'],
        skillsPreferred: ['Kafka'],
      },
    ],
    semanticSearchQueries: [],
    semanticSearchExecutions: [],
  };
}

function candidateMatchesWhere(candidate, where = {}) {
  if (where.id?.in && !where.id.in.includes(candidate.id)) return false;
  if (where.id && typeof where.id === 'string' && candidate.id !== where.id) return false;
  if (where.organisationId && candidate.organisationId !== where.organisationId) return false;
  if (where.location?.contains && !String(candidate.location || '').toLowerCase().includes(String(where.location.contains).toLowerCase())) return false;
  if (where.totalExperience?.gte != null && (candidate.totalExperience || 0) < where.totalExperience.gte) return false;
  if (where.totalExperience?.lte != null && (candidate.totalExperience || 0) > where.totalExperience.lte) return false;

  if (where.OR?.length) {
    const matchesOr = where.OR.some((entry) => {
      if (entry.organisationId) return candidate.organisationId === entry.organisationId;
      if (entry.applications?.some?.organisationId) {
        return state.applications.some((application) => application.candidateId === candidate.id && application.organisationId === entry.applications.some.organisationId);
      }
      if (entry.savedByRecruiters?.some?.organisationId) {
        return state.savedCandidates.some((saved) => saved.candidateId === candidate.id && saved.organisationId === entry.savedByRecruiters.some.organisationId);
      }
      const fields = ['fullName', 'headline', 'currentTitle', 'summary'];
      return fields.some((field) => {
        const contains = entry[field]?.contains;
        return contains ? String(candidate[field] || '').toLowerCase().includes(String(contains).toLowerCase()) : false;
      });
    });
    if (!matchesOr) return false;
  }

  return true;
}

function installPrismaMocks() {
  prisma.organisation ||= {};
  prisma.organisationMembership ||= {};
  prisma.featureFlag ||= {};
  prisma.candidateProfile ||= {};
  prisma.application ||= {};
  prisma.savedCandidate ||= {};
  prisma.recruiterSavedSearch ||= {};
  prisma.candidateIntelligenceState ||= {};
  prisma.job ||= {};
  prisma.semanticSearchQuery ||= {};
  prisma.semanticSearchExecution ||= {};

  prisma.organisation.findFirst = async ({ where = {} } = {}) => clone(
    state.organisations.find((item) => (!where.id || item.id === where.id) && (!where.status || item.status === where.status)) || null
  );

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} } = {}) => state.memberships
    .filter((item) => item.userId === where.userId && item.status === where.status)
    .map((item) => ({
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId) || null) : undefined,
      customRoleDefinition: null,
    }));

  prisma.featureFlag.findMany = async ({ where = {} } = {}) => state.featureFlags
    .filter((item) => item.organisationId === where.organisationId && (!where.key?.in || where.key.in.includes(item.key)))
    .map(clone);
  prisma.featureFlag.createMany = async () => ({ count: 0 });
  prisma.featureFlag.create = async ({ data }) => {
    const created = { id: `flag-${state.featureFlags.length + 1}`, createdAt: now(), updatedAt: now(), ...clone(data) };
    state.featureFlags.push(created);
    return clone(created);
  };
  prisma.featureFlag.findUnique = async ({ where } = {}) => clone(
    state.featureFlags.find((item) => item.organisationId === where.organisationId_key.organisationId && item.key === where.organisationId_key.key) || null
  );

  prisma.candidateProfile.findFirst = async ({ where = {}, select = {} } = {}) => {
    const candidate = state.candidates.find((item) => candidateMatchesWhere(item, where)) || null;
    if (!candidate) return null;
    if (!Object.keys(select).length) return clone(candidate);
    return Object.fromEntries(Object.entries(select).map(([key, enabled]) => [key, enabled ? clone(candidate[key]) : undefined]));
  };

  prisma.candidateProfile.findMany = async ({ where = {}, include = {} } = {}) => state.candidates
    .filter((candidate) => candidateMatchesWhere(candidate, where))
    .map((candidate) => ({
      ...clone(candidate),
      user: include.user ? null : undefined,
      resumeBuilder: include.resumeBuilder ? null : undefined,
      applications: include.applications
        ? state.applications.filter((application) => application.candidateId === candidate.id).map(clone)
        : undefined,
      savedByRecruiters: include.savedByRecruiters
        ? state.savedCandidates.filter((saved) => saved.candidateId === candidate.id && (!include.savedByRecruiters.where?.organisationId || saved.organisationId === include.savedByRecruiters.where.organisationId)).map(clone)
        : undefined,
    }));

  prisma.application.findMany = async ({ where = {}, select = {} } = {}) => state.applications
    .filter((item) => (!where.organisationId || item.organisationId === where.organisationId))
    .map((item) => (Object.keys(select).length ? Object.fromEntries(Object.keys(select).map((key) => [key, clone(item[key])])) : clone(item)));

  prisma.savedCandidate.findMany = async () => [];
  prisma.recruiterSavedSearch.create = async () => ({ id: 'recent-search-1' });

  prisma.candidateIntelligenceState.findMany = async ({ where = {} } = {}) => state.candidateIntelligenceStates
    .filter((item) => (!where.candidateId?.in || where.candidateId.in.includes(item.candidateId)) && item.kind === where.kind)
    .map(clone);

  prisma.job.findFirst = async ({ where = {}, select = {} } = {}) => {
    const job = state.jobs.find((item) => item.id === where.id && item.organisationId === where.organisationId) || null;
    if (!job) return null;
    if (!Object.keys(select).length) return clone(job);
    return Object.fromEntries(Object.entries(select).map(([key, enabled]) => [key, enabled ? clone(job[key]) : undefined]));
  };

  prisma.semanticSearchQuery.findFirst = async ({ where = {} } = {}) => clone(
    state.semanticSearchQueries
      .filter((item) => item.organisationId === where.organisationId && item.createdByUserId === where.createdByUserId)
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null
  );
  prisma.semanticSearchQuery.create = async ({ data } = {}) => {
    const created = {
      id: `query-${state.semanticSearchQueries.length + 1}`,
      createdAt: now(),
      ...clone(data),
    };
    state.semanticSearchQueries.push(created);
    return clone(created);
  };
  prisma.semanticSearchExecution.create = async ({ data } = {}) => {
    const created = {
      id: `execution-${state.semanticSearchExecutions.length + 1}`,
      createdAt: now(),
      completedAt: null,
      ...clone(data),
    };
    state.semanticSearchExecutions.push(created);
    return clone(created);
  };
  prisma.semanticSearchExecution.update = async ({ where, data } = {}) => {
    const execution = state.semanticSearchExecutions.find((item) => item.id === where.id);
    Object.assign(execution, clone(data));
    return clone(execution);
  };
}

function recruiterActor() {
  return clone(state.users.find((item) => item.id === 'recruiter-1'));
}

function interviewerActor() {
  return clone(state.users.find((item) => item.id === 'interviewer-1'));
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ parseSearchQuery } = await import('../intelligence/services/queryParserService.js'));
  ({ extractSearchIntent } = await import('../intelligence/services/queryIntentService.js'));
  ({
    searchSemanticCandidates,
    previewSemanticSearch,
    getSemanticSearchIntent,
  } = await import('../intelligence/services/semanticSearchService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'MOCK';
  env.elasticsearchEnabled = false;
});

test('parseSearchQuery preserves boolean operators, phrases, and inline filters', () => {
  const parsed = parseSearchQuery({
    query: '"spring boot" AND java NOT react location:Bangalore experience:5-8 notice:30',
  });

  assert.equal(parsed.mode, 'BOOLEAN');
  assert.deepEqual(parsed.quotedPhrases, ['spring boot']);
  assert.deepEqual(parsed.operators, ['AND', 'NOT']);
  assert.equal(parsed.filters.location, 'Bangalore');
  assert.equal(parsed.filters.minExperience, 5);
  assert.equal(parsed.filters.maxExperience, 8);
  assert.equal(parsed.filters.noticePeriodDaysMax, 30);
  assert.ok(parsed.booleanAst);
});

test('extractSearchIntent merges deterministic skills and experience into canonical intent', () => {
  const parsed = parseSearchQuery({
    query: 'Senior java spring boot engineer in Bangalore with 5-8 years remote',
  });
  const intent = extractSearchIntent(parsed, { semanticEnabled: true });

  assert.equal(intent.mode, 'SEMANTIC');
  assert.equal(intent.role, 'Engineer');
  assert.equal(intent.filters.location, 'Bangalore');
  assert.equal(intent.filters.workMode, 'REMOTE');
  assert.deepEqual(intent.filters.skills, ['Java', 'Spring Boot']);
  assert.equal(intent.years.min, 5);
  assert.equal(intent.years.max, 8);
});

test('searchSemanticCandidates returns organisation-scoped results with intelligence-expanded terms', async () => {
  const result = await searchSemanticCandidates(recruiterActor(), {
    query: 'Senior backend engineer in Bangalore with Java and Spring Boot',
    includeMatch: false,
    page: 1,
    pageSize: 10,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].candidate.id, 'c000000000000000000000001');
  assert.equal(result.items[0].candidate.fullName, 'Asha Backend');
  assert.ok(result.items[0].retrievalReasons.some((reason) => reason.includes('Matched skills')));
  assert.ok(result.items[0].expandedTerms.includes('Spring Boot'));
  assert.ok(result.items[0].expandedTerms.includes('Java'));
  assert.ok(result.items[0].transferableTerms.length >= 0);
  assert.equal(result.plan.retrievalStrategy, 'DATABASE');
});

test('previewSemanticSearch limits page size and suppresses optional match generation', async () => {
  const result = await previewSemanticSearch(recruiterActor(), {
    query: 'engineer',
    pageSize: 25,
  });

  assert.equal(result.meta.page, 1);
  assert.ok(result.meta.pageSize <= 5);
  assert.ok(result.items.every((item) => item.matchResult == null));
});

test('getSemanticSearchIntent derives query from similar job context', async () => {
  const intent = await getSemanticSearchIntent(recruiterActor(), {
    query: '',
    similarJobId: 'j000000000000000000000001',
  });

  assert.equal(intent.role, 'Senior Backend Engineer');
  assert.ok(intent.filters.skills.includes('Java'));
  assert.ok(intent.filters.skills.includes('Spring Boot'));
});

test('semantic search remains available in deterministic mode when provider is disabled', async () => {
  env.intelligenceEnabled = false;

  const result = await searchSemanticCandidates(recruiterActor(), {
    query: 'Senior backend engineer',
    includeMatch: false,
  });

  assert.equal(result.intent.semanticEnabled, false);
  assert.equal(result.items.length, 2);
});

test('semantic search enforces enterprise permissions', async () => {
  await assert.rejects(
    () => searchSemanticCandidates(interviewerActor(), { query: 'backend engineer' }),
    (error) => error?.statusCode === 403,
  );
});
