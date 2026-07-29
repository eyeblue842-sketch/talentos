import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let expandSemanticSkills;
let searchSimilarCandidateProfiles;
let searchSimilarJobProfiles;
let listSemanticSearchHistory;
let getSemanticSearchHistoryDetail;
let searchSemanticCandidates;
let createSavedCandidateSearch;
let listSavedCandidateSearches;
let getSavedCandidateSearch;
let updateSavedCandidateSearch;
let archiveSavedCandidateSearch;
let executeSavedCandidateSearch;
let getSemanticSearchSuggestions;

let state;

function now() {
  return new Date('2026-07-29T12:00:00.000Z');
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function seedState() {
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'org-2', name: 'Beta', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'recruiter-1', role: 'RECRUITER', email: 'recruiter@acme.com', isActive: true, sessionVersion: 0 },
      { id: 'admin-1', role: 'ADMIN', email: 'admin@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'recruiter-2', role: 'RECRUITER', email: 'other@careeriz.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'admin-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-3', organisationId: 'org-2', userId: 'recruiter-2', role: 'RECRUITER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.semantic_search', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-2', organisationId: 'org-1', key: 'intelligence.semantic_search_expansion', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-3', organisationId: 'org-1', key: 'intelligence.saved_searches', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-4', organisationId: 'org-1', key: 'intelligence.search_history', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-5', organisationId: 'org-1', key: 'intelligence.search_suggestions', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-6', organisationId: 'org-1', key: 'intelligence.similar_candidate_search', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-7', organisationId: 'org-1', key: 'intelligence.similar_job_search', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    candidates: [
      {
        id: 'c000000000000000000000010',
        organisationId: 'org-1',
        fullName: 'Asha Backend',
        headline: 'Senior Backend Engineer',
        currentTitle: 'Senior Backend Engineer',
        location: 'Bangalore',
        totalExperience: 7,
        skills: ['Java', 'Spring Boot', 'AWS'],
        frameworks: ['Spring Framework'],
        tools: ['Docker'],
        cloudPlatforms: ['AWS'],
        databases: ['PostgreSQL'],
        currentEmployer: 'Acme Labs',
        latestResumeAssetId: 'resume-1',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'c000000000000000000000011',
        organisationId: 'org-1',
        fullName: 'Mira Platform',
        headline: 'Platform Engineer',
        currentTitle: 'Platform Engineer',
        location: 'Bangalore',
        totalExperience: 6,
        skills: ['AWS', 'Terraform', 'Kubernetes'],
        frameworks: [],
        tools: ['Docker'],
        cloudPlatforms: ['AWS'],
        databases: [],
        currentEmployer: 'Cloud Labs',
        latestResumeAssetId: 'resume-2',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'c000000000000000000000012',
        organisationId: 'org-2',
        fullName: 'Other Org Candidate',
        headline: 'Senior Backend Engineer',
        currentTitle: 'Senior Backend Engineer',
        location: 'Bangalore',
        totalExperience: 8,
        skills: ['Java', 'Spring Boot', 'AWS'],
        currentEmployer: 'Other Corp',
        latestResumeAssetId: 'resume-3',
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    applications: [
      { id: 'app-1', organisationId: 'org-1', candidateId: 'c000000000000000000000010', currentStage: 'APPLIED', statusLabel: 'Applied', updatedAt: now() },
      { id: 'app-2', organisationId: 'org-1', candidateId: 'c000000000000000000000011', currentStage: 'APPLIED', statusLabel: 'Applied', updatedAt: now() },
    ],
    jobs: [
      {
        id: 'j000000000000000000000010',
        organisationId: 'org-1',
        title: 'Backend Engineer',
        location: 'Bangalore',
        workplaceType: 'HYBRID',
        employmentType: 'FULL_TIME',
        experienceMin: 5,
        experienceMax: 8,
        skillsRequired: ['Java', 'Spring Boot'],
        requirements: ['Build services'],
        responsibilities: ['Own APIs'],
      },
    ],
    candidateIntelligenceStates: [],
    semanticSearchQueries: [],
    semanticSearchExecutions: [],
    savedCandidateSearches: [],
    auditLogs: [],
  };
}

function candidateMatchesWhere(candidate, where = {}) {
  if (where.id?.in && !where.id.in.includes(candidate.id)) return false;
  if (where.id && typeof where.id === 'string' && candidate.id !== where.id) return false;
  if (where.organisationId && candidate.organisationId !== where.organisationId) return false;
  if (where.OR?.length) {
    return where.OR.some((entry) => {
      if (entry.organisationId) return candidate.organisationId === entry.organisationId;
      if (entry.applications?.some?.organisationId) {
        return state.applications.some((app) => app.candidateId === candidate.id && app.organisationId === entry.applications.some.organisationId);
      }
      if (entry.savedByRecruiters?.some?.organisationId) return false;
      const fields = ['fullName', 'headline', 'currentTitle', 'summary'];
      return fields.some((field) => entry[field]?.contains && String(candidate[field] || '').toLowerCase().includes(String(entry[field].contains).toLowerCase()));
    });
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
  prisma.savedCandidateSearch ||= {};
  prisma.auditLog ||= {};

  prisma.organisation.findFirst = async ({ where = {} } = {}) => clone(state.organisations.find((item) => (!where.id || item.id === where.id) && (!where.status || item.status === where.status)) || null);
  prisma.organisationMembership.findMany = async ({ where = {}, include = {} } = {}) => state.memberships
    .filter((item) => item.userId === where.userId && item.status === where.status)
    .map((item) => ({ ...clone(item), organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId) || null) : undefined, customRoleDefinition: null }));

  prisma.featureFlag.findMany = async ({ where = {} } = {}) => state.featureFlags.filter((item) => item.organisationId === where.organisationId && (!where.key?.in || where.key.in.includes(item.key))).map(clone);
  prisma.featureFlag.findUnique = async ({ where } = {}) => clone(state.featureFlags.find((item) => item.organisationId === where.organisationId_key.organisationId && item.key === where.organisationId_key.key) || null);
  prisma.featureFlag.create = async ({ data } = {}) => {
    const created = { id: `flag-${state.featureFlags.length + 1}`, createdAt: now(), updatedAt: now(), ...clone(data) };
    state.featureFlags.push(created);
    return clone(created);
  };

  prisma.candidateProfile.findFirst = async ({ where = {}, select = {} } = {}) => {
    const candidate = state.candidates.find((item) => candidateMatchesWhere(item, where)) || null;
    if (!candidate) return null;
    if (!Object.keys(select).length) return clone(candidate);
    return Object.fromEntries(Object.entries(select).map(([key, enabled]) => [key, enabled ? clone(candidate[key]) : undefined]));
  };
  prisma.candidateProfile.findMany = async ({ where = {}, include = {}, select = null } = {}) => state.candidates
    .filter((candidate) => candidateMatchesWhere(candidate, where))
    .map((candidate) => {
      if (select) {
        return Object.fromEntries(Object.entries(select).map(([key, enabled]) => [key, enabled ? clone(candidate[key]) : undefined]));
      }
      return {
        ...clone(candidate),
        user: include.user ? null : undefined,
        resumeBuilder: include.resumeBuilder ? null : undefined,
        applications: include.applications ? state.applications.filter((application) => application.candidateId === candidate.id).map(clone) : undefined,
        savedByRecruiters: include.savedByRecruiters ? [] : undefined,
      };
    });

  prisma.application.findMany = async ({ where = {}, select = {} } = {}) => state.applications
    .filter((item) => (!where.organisationId || item.organisationId === where.organisationId))
    .map((item) => (Object.keys(select).length ? Object.fromEntries(Object.keys(select).map((key) => [key, clone(item[key])])) : clone(item)));
  prisma.savedCandidate.findMany = async () => [];
  prisma.recruiterSavedSearch.create = async () => ({ id: 'recent-search-1' });
  prisma.candidateIntelligenceState.findMany = async () => [];

  prisma.job.findFirst = async ({ where = {}, select = {} } = {}) => {
    const job = state.jobs.find((item) => item.id === where.id && item.organisationId === where.organisationId) || null;
    if (!job) return null;
    if (!Object.keys(select).length) return clone(job);
    return Object.fromEntries(Object.entries(select).map(([key, enabled]) => [key, enabled ? clone(job[key]) : undefined]));
  };

  prisma.semanticSearchQuery.findFirst = async ({ where = {}, include = {} } = {}) => {
    const rows = state.semanticSearchQueries
      .filter((item) => item.organisationId === where.organisationId && item.createdByUserId === where.createdByUserId);
    rows.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const row = rows[0] || null;
    if (!row) return null;
    return {
      ...clone(row),
      executions: include.executions
        ? state.semanticSearchExecutions.filter((execution) => execution.queryId === row.id).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, include.executions.take || 10).map(clone)
        : undefined,
    };
  };
  prisma.semanticSearchQuery.create = async ({ data } = {}) => {
    const created = { id: `query-${state.semanticSearchQueries.length + 1}`, createdAt: now(), ...clone(data) };
    state.semanticSearchQueries.push(created);
    return clone(created);
  };
  prisma.semanticSearchQuery.count = async ({ where = {} } = {}) => state.semanticSearchQueries.filter((item) => item.organisationId === where.organisationId && item.createdByUserId === where.createdByUserId).length;
  prisma.semanticSearchQuery.findMany = async ({ where = {}, include = {}, orderBy, skip = 0, take = 50 } = {}) => state.semanticSearchQueries
    .filter((item) => item.organisationId === where.organisationId && item.createdByUserId === where.createdByUserId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(skip, skip + take)
    .map((item) => ({
      ...clone(item),
      executions: include.executions
        ? state.semanticSearchExecutions.filter((execution) => execution.queryId === item.id).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, include.executions.take || 10).map(clone)
        : undefined,
    }));

  prisma.semanticSearchExecution.create = async ({ data } = {}) => {
    const created = { id: `execution-${state.semanticSearchExecutions.length + 1}`, createdAt: now(), completedAt: null, ...clone(data) };
    state.semanticSearchExecutions.push(created);
    return clone(created);
  };
  prisma.semanticSearchExecution.update = async ({ where, data } = {}) => {
    const execution = state.semanticSearchExecutions.find((item) => item.id === where.id);
    Object.assign(execution, clone(data));
    return clone(execution);
  };

  prisma.savedCandidateSearch.findMany = async ({ where = {}, orderBy, take = 50 } = {}) => state.savedCandidateSearches
    .filter((item) => item.organisationId === where.organisationId && (
      !where.OR
      || where.OR.some((entry) => (entry.ownerUserId && item.ownerUserId === entry.ownerUserId) || (entry.isShared && item.isShared === entry.isShared))
    ))
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
    .slice(0, take)
    .map(clone);
  prisma.savedCandidateSearch.findFirst = async ({ where = {} } = {}) => clone(
    state.savedCandidateSearches.find((item) => item.id === where.id && item.organisationId === where.organisationId && (
      !where.OR
      || where.OR.some((entry) => (entry.ownerUserId && item.ownerUserId === entry.ownerUserId) || (entry.isShared && item.isShared === entry.isShared))
    )) || null
  );
  prisma.savedCandidateSearch.create = async ({ data } = {}) => {
    const created = { id: `saved-${state.savedCandidateSearches.length + 1}`, createdAt: now(), updatedAt: now(), lastExecutedAt: null, ...clone(data) };
    state.savedCandidateSearches.push(created);
    return clone(created);
  };
  prisma.savedCandidateSearch.update = async ({ where, data } = {}) => {
    const row = state.savedCandidateSearches.find((item) => item.id === where.id);
    Object.assign(row, clone(data), { updatedAt: now() });
    return clone(row);
  };

  prisma.auditLog.create = async ({ data } = {}) => {
    const created = { id: `audit-${state.auditLogs.length + 1}`, createdAt: now(), ...clone(data) };
    state.auditLogs.push(created);
    return clone(created);
  };
}

function recruiterActor() {
  return clone(state.users.find((item) => item.id === 'recruiter-1'));
}

function adminActor() {
  return clone(state.users.find((item) => item.id === 'admin-1'));
}

function otherRecruiter() {
  return clone(state.users.find((item) => item.id === 'recruiter-2'));
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ expandSemanticSkills } = await import('../intelligence/services/semanticSkillExpansionService.js'));
  ({
    searchSimilarCandidateProfiles,
    searchSimilarJobProfiles,
    listSemanticSearchHistory,
    getSemanticSearchHistoryDetail,
    searchSemanticCandidates,
  } = await import('../intelligence/services/semanticSearchService.js'));
  ({
    createSavedCandidateSearch,
    listSavedCandidateSearches,
    getSavedCandidateSearch,
    updateSavedCandidateSearch,
    archiveSavedCandidateSearch,
    executeSavedCandidateSearch,
  } = await import('../intelligence/services/savedCandidateSearchService.js'));
  ({ getSemanticSearchSuggestions } = await import('../intelligence/services/searchQuerySuggestionService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'MOCK';
  env.elasticsearchEnabled = false;
});

test('skill expansion returns bounded alias, related, and transferable terms without duplicates', () => {
  const result = expandSemanticSkills(['React', 'reactjs', 'AWS'], {
    expansionEnabled: true,
    transferableSkillsEnabled: true,
  });

  assert.ok(result.expansions.some((item) => item.relationshipType === 'ALIAS' && item.normalizedTerm === 'React'));
  assert.ok(result.expansions.some((item) => item.relationshipType === 'TRANSFERABLE'));
  assert.ok(result.expansions.length <= 16);
  const uniqueKeys = new Set(result.expansions.map((item) => `${item.normalizedTerm}:${item.expandedTerm}:${item.relationshipType}`));
  assert.equal(uniqueKeys.size, result.expansions.length);
});

test('similar candidate search uses structured source candidate context and stays org-scoped', async () => {
  const result = await searchSimilarCandidateProfiles(recruiterActor(), {
    sourceCandidateId: 'c000000000000000000000010',
    includeMatch: false,
  });

  assert.ok(result.items.length >= 1);
  assert.equal(result.query.mode, 'SIMILAR_CANDIDATE');
  assert.ok(result.items.every((item) => item.candidate.id !== 'c000000000000000000000012'));
});

test('similar job search reuses job context without duplicating match semantics', async () => {
  const result = await searchSimilarJobProfiles(recruiterActor(), {
    sourceJobId: 'j000000000000000000000010',
    includeMatch: false,
  });

  assert.equal(result.query.mode, 'SIMILAR_JOB');
  assert.ok(result.intent.filters.requiredSkills.includes('Java'));
  assert.ok(result.items.every((item) => item.match.included === false));
});

test('executed semantic searches persist query and execution history with immediate deduplication', async () => {
  await searchSemanticCandidates(recruiterActor(), {
    query: 'java spring boot bangalore',
    includeMatch: false,
  });
  await searchSemanticCandidates(recruiterActor(), {
    query: 'java spring boot bangalore',
    includeMatch: false,
  });

  assert.equal(state.semanticSearchQueries.length, 1);
  assert.equal(state.semanticSearchExecutions.length, 2);

  const history = await listSemanticSearchHistory(recruiterActor(), { page: 1, pageSize: 10 });
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].latestExecution.resultCount >= 0, true);
});

test('history detail is private to the current recruiter', async () => {
  await searchSemanticCandidates(recruiterActor(), {
    query: 'aws terraform',
    includeMatch: false,
  });

  const detail = await getSemanticSearchHistoryDetail(recruiterActor(), state.semanticSearchQueries[0].id);
  assert.ok(detail.executions.length >= 1);

  await assert.rejects(
    () => getSemanticSearchHistoryDetail(otherRecruiter(), state.semanticSearchQueries[0].id),
    (error) => error?.statusCode === 404 || error?.statusCode === 403,
  );
});

test('saved semantic searches support create, read, update, archive, and execute', async () => {
  const created = await createSavedCandidateSearch(recruiterActor(), {
    name: 'Backend Bangalore',
    description: 'Core backend search',
    rawQuery: 'java spring boot bangalore',
    searchMode: 'HYBRID',
    filtersJson: { location: 'Bangalore' },
  });

  const listed = await listSavedCandidateSearches(recruiterActor());
  assert.equal(listed.length, 1);

  const fetched = await getSavedCandidateSearch(recruiterActor(), created.id);
  assert.equal(fetched.name, 'Backend Bangalore');

  const updated = await updateSavedCandidateSearch(recruiterActor(), created.id, {
    name: 'Backend Bangalore Updated',
    isShared: false,
  });
  assert.equal(updated.name, 'Backend Bangalore Updated');

  const executed = await executeSavedCandidateSearch(recruiterActor(), created.id);
  assert.ok(executed.items.length >= 1);

  const archived = await archiveSavedCandidateSearch(recruiterActor(), created.id);
  assert.equal(archived.isActive, false);
});

test('saved semantic searches enforce ownership and organisation isolation', async () => {
  const created = await createSavedCandidateSearch(recruiterActor(), {
    name: 'Private Search',
    rawQuery: 'java',
    searchMode: 'KEYWORD',
    filtersJson: {},
  });

  await assert.rejects(
    () => updateSavedCandidateSearch(otherRecruiter(), created.id, { name: 'Nope' }),
    (error) => error?.statusCode === 404 || error?.statusCode === 403,
  );
});

test('search suggestions are deterministic and use query, recent history, saved search, and context', async () => {
  await searchSemanticCandidates(recruiterActor(), {
    query: 'java',
    includeMatch: false,
  });
  await createSavedCandidateSearch(recruiterActor(), {
    name: 'Cloud Search',
    rawQuery: 'aws kubernetes',
    searchMode: 'KEYWORD',
    filtersJson: {},
  });

  const result = await getSemanticSearchSuggestions(recruiterActor(), {
    query: 'java',
    sourceJobId: 'j000000000000000000000010',
    limit: 8,
  });

  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.some((item) => item.source === 'QUERY'));
  assert.ok(result.suggestions.some((item) => item.source === 'SAVED_SEARCH' || item.source === 'RECENT_SEARCH'));
});

test('retrieval score remains separate from optional match data', async () => {
  const result = await searchSemanticCandidates(recruiterActor(), {
    query: 'java spring boot',
    includeMatch: false,
  });

  const first = result.items[0];
  assert.equal(first.retrieval.score, first.retrievalScore);
  assert.equal(first.match.included, false);
  assert.equal(first.candidate.matchScore, first.retrievalScore);
});
