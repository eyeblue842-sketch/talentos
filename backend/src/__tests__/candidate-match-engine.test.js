import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let getCandidateJobMatch;
let getCandidateJobMatchStatus;
let regenerateCandidateJobMatch;
let runCandidateJobMatchGenerationTask;
let getCandidateMatchIntelligence;
let buildCandidateJobMatchSourceFingerprint;
let calculateCandidateJobMatchScore;
let resetIntelligenceProvider;

let state;
let idCounter = 1;
let originalEnv = {};

function now() {
  return new Date('2026-07-28T11:00:00.000Z');
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function seedState() {
  idCounter = 1;
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'org-2', name: 'Beta', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'admin-1', role: 'ADMIN', email: 'admin@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'recruiter-1', role: 'RECRUITER', email: 'recruiter@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'viewer-1', role: 'RECRUITER', email: 'viewer@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'other-1', role: 'RECRUITER', email: 'other@careeriz.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'viewer-1', role: 'INTERVIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-3', organisationId: 'org-2', userId: 'other-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.candidate_matching', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-2', organisationId: 'org-2', key: 'intelligence.candidate_matching', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    candidates: [
      {
        id: 'candidate-1',
        organisationId: 'org-1',
        fullName: 'Candidate Person',
        email: 'candidate@example.com',
        phoneNumber: '9999999999',
        linkedInUrlNormalized: 'linkedin.com/in/candidate',
        headline: 'Senior Backend Engineer',
        currentTitle: 'Senior Backend Engineer',
        currentEmployer: 'Acme Labs',
        location: 'Bangalore',
        totalExperience: 7,
        expectedCtcLpa: 24,
        noticePeriodDays: 30,
        salaryVisibleToRecruiters: true,
        workplacePreferences: ['HYBRID'],
        employmentPreferences: ['FULL_TIME'],
        skills: ['Java', 'Spring Boot', 'AWS'],
        functionalSkills: ['Microservices'],
        tools: ['Docker'],
        frameworks: ['Spring Framework'],
        cloudPlatforms: ['AWS'],
        databases: ['PostgreSQL'],
        educationEntries: [{ institution: 'VTU', degree: 'B.Tech', completionYear: 2018 }],
        searchableProfile: true,
        latestResumeAssetId: 'resume-1',
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    jobs: [
      {
        id: 'job-1',
        organisationId: 'org-1',
        recruiterId: 'recruiter-1',
        requisitionId: null,
        title: 'Senior Backend Engineer',
        description: 'Build reliable backend services with Java, Spring Boot, and AWS.',
        skillsRequired: ['Java', 'Spring Boot', 'AWS'],
        skillsPreferred: ['Docker', 'Kafka'],
        experienceMin: 5,
        experienceMax: 9,
        salaryMin: 18,
        salaryMax: 30,
        currency: 'INR',
        location: 'Bangalore',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        responsibilities: [],
        requirements: [],
        benefits: [],
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    resumeAssets: [
      {
        id: 'resume-1',
        candidateId: 'candidate-1',
        ownerUserId: 'recruiter-1',
        originalFilename: 'candidate.pdf',
        storageKey: 'resumes/mock.pdf',
        storageProvider: 'local',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        parsingStatus: 'PARTIAL',
        parsedText: 'Candidate Person Senior Backend Engineer Java Spring Boot AWS',
        parsedData: { parser: 'mock-parser-v1', suggestedUpdates: { skills: ['Java', 'Spring Boot', 'AWS'] } },
        externalResumeVersion: null,
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    candidateIntelligenceStates: [
      {
        id: 'cis-1',
        organisationId: 'org-1',
        candidateId: 'candidate-1',
        kind: 'PROFILE_OVERVIEW',
        status: 'READY',
        latestExecutionId: 'ci-exec-1',
        latestResultId: 'ci-result-1',
        sourceFingerprint: 'candidate-intel-fingerprint',
        resultVersion: 'candidate-intelligence-v1',
      },
    ],
    jobDescriptionStates: [
      {
        id: 'jds-1',
        organisationId: 'org-1',
        jobId: 'job-1',
        kind: 'FULL_DESCRIPTION',
        status: 'READY',
        latestExecutionId: 'jd-exec-1',
        latestResultId: 'jd-result-1',
        sourceFingerprint: 'job-desc-fingerprint',
        resultVersion: 'job-description-v2',
      },
    ],
    candidateJobMatchStates: [],
    intelligenceExecutions: [],
    intelligenceResults: [],
    backgroundTasks: [],
    auditLogs: [],
    matchScoringProfiles: [],
    matchScoringProfileVersions: [],
  };
}

function applyData(target, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('increment' in value) {
        target[key] = (target[key] || 0) + value.increment;
        continue;
      }
    }
    target[key] = value;
  }
  target.updatedAt = now();
  return target;
}

function withCandidateRelations(candidate) {
  if (!candidate) return null;
  return {
    ...clone(candidate),
    latestResumeAsset: clone(state.resumeAssets.find((item) => item.id === candidate.latestResumeAssetId) || null),
  };
}

function withJobRelations(job) {
  if (!job) return null;
  return {
    ...clone(job),
    requisition: null,
  };
}

function installPrismaMocks() {
  prisma.organisation ||= {};
  prisma.organisationMembership ||= {};
  prisma.featureFlag ||= {};
  prisma.candidateProfile ||= {};
  prisma.job ||= {};
  prisma.resumeAsset ||= {};
  prisma.candidateIntelligenceState ||= {};
  prisma.jobDescriptionState ||= {};
  prisma.candidateJobMatchState ||= {};
  prisma.intelligenceExecution ||= {};
  prisma.intelligenceResult ||= {};
  prisma.backgroundTask ||= {};
  prisma.auditLog ||= {};
  prisma.user ||= {};
  prisma.matchScoringProfile ||= {};
  prisma.matchScoringProfileVersion ||= {};

  // ensureDefaultMatchScoringProfile() (matchScoringProfileService.js) reads
  // and writes these two models directly against the real Prisma client
  // when their methods exist, rather than falling back to its own stub -
  // without mocking them here the same way as every other model in this
  // file, it hits the real (unmocked) database and fails on a foreign key
  // constraint since org-1/org-2 only exist in this in-memory state.
  function withMatchScoringProfileRelations(profile, include = {}) {
    if (!profile) return null;
    const versions = state.matchScoringProfileVersions.filter((item) => item.profileId === profile.id);
    return {
      ...clone(profile),
      activeVersion: include.activeVersion
        ? clone(versions.find((item) => item.id === profile.activeVersionId) || null)
        : undefined,
      versions: include.versions
        ? versions.slice().sort((a, b) => b.version - a.version).slice(0, include.versions.take || versions.length).map(clone)
        : undefined,
    };
  }

  prisma.matchScoringProfile.findFirst = async ({ where = {}, include = {} } = {}) => {
    const found = state.matchScoringProfiles.find((item) => (
      (!where.id || item.id === where.id)
      && (!where.organisationId || item.organisationId === where.organisationId)
      && (!where.key || item.key === where.key)
    )) || null;
    return withMatchScoringProfileRelations(found, include);
  };

  prisma.matchScoringProfile.create = async ({ data } = {}) => {
    const profile = {
      id: nextId('match-scoring-profile'),
      activeVersionId: null,
      activatedAt: null,
      activatedByUserId: null,
      archivedAt: null,
      createdAt: now(),
      updatedAt: now(),
      ...clone(data),
    };
    state.matchScoringProfiles.push(profile);
    return clone(profile);
  };

  prisma.matchScoringProfile.update = async ({ where, data } = {}) => {
    const profile = state.matchScoringProfiles.find((item) => item.id === where.id);
    applyData(profile, data);
    return clone(profile);
  };

  prisma.matchScoringProfileVersion.findFirst = async ({ where = {} } = {}) => {
    const matches = state.matchScoringProfileVersions.filter((item) => (
      (!where.profileId || item.profileId === where.profileId)
    ));
    const found = matches.slice().sort((a, b) => b.version - a.version)[0] || null;
    return clone(found);
  };

  prisma.matchScoringProfileVersion.create = async ({ data } = {}) => {
    const version = {
      id: nextId('match-scoring-profile-version'),
      createdAt: now(),
      ...clone(data),
    };
    state.matchScoringProfileVersions.push(version);
    return clone(version);
  };

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
  prisma.featureFlag.createMany = async ({ data = [] } = {}) => {
    for (const item of data) {
      if (!state.featureFlags.find((flag) => flag.organisationId === item.organisationId && flag.key === item.key)) {
        state.featureFlags.push({ id: nextId('flag'), createdAt: now(), updatedAt: now(), ...clone(item) });
      }
    }
    return { count: data.length };
  };
  prisma.featureFlag.findUnique = async ({ where } = {}) => clone(
    state.featureFlags.find((item) => item.organisationId === where.organisationId_key.organisationId && item.key === where.organisationId_key.key) || null
  );

  prisma.candidateProfile.findFirst = async ({ where = {} } = {}) => {
    const found = state.candidates.find((candidate) => {
      if (where.id && candidate.id !== where.id) return false;
      if (!where.OR) return true;
      return where.OR.some((entry) => {
        if (entry.organisationId && candidate.organisationId === entry.organisationId) return true;
        if (entry.applications?.some?.organisationId && candidate.organisationId === entry.applications.some.organisationId) return true;
        if (entry.savedByRecruiters?.some?.organisationId && candidate.organisationId === entry.savedByRecruiters.some.organisationId) return true;
        return false;
      });
    });
    return withCandidateRelations(found);
  };

  prisma.job.findFirst = async ({ where = {} } = {}) => withJobRelations(
    state.jobs.find((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId)) || null
  );

  prisma.candidateIntelligenceState.findUnique = async ({ where = {} } = {}) => clone(
    state.candidateIntelligenceStates.find((item) => (
      item.organisationId === where.organisationId_candidateId_kind.organisationId
      && item.candidateId === where.organisationId_candidateId_kind.candidateId
      && item.kind === where.organisationId_candidateId_kind.kind
    )) || null
  );

  prisma.jobDescriptionState.findUnique = async ({ where = {} } = {}) => clone(
    state.jobDescriptionStates.find((item) => (
      item.organisationId === where.organisationId_jobId_kind.organisationId
      && item.jobId === where.organisationId_jobId_kind.jobId
      && item.kind === where.organisationId_jobId_kind.kind
    )) || null
  );

  prisma.candidateJobMatchState.findUnique = async ({ where = {}, include = {} } = {}) => {
    const found = state.candidateJobMatchStates.find((item) => (
      item.organisationId === where.organisationId_candidateId_jobId.organisationId
      && item.candidateId === where.organisationId_candidateId_jobId.candidateId
      && item.jobId === where.organisationId_candidateId_jobId.jobId
    )) || null;
    if (!found) return null;
    return {
      ...clone(found),
      latestExecution: include.latestExecution ? clone(state.intelligenceExecutions.find((item) => item.id === found.latestExecutionId) || null) : undefined,
      latestResult: include.latestResult ? {
        ...clone(state.intelligenceResults.find((item) => item.id === found.latestResultId) || null),
        execution: clone(state.intelligenceExecutions.find((item) => item.id === found.latestExecutionId) || null),
      } : undefined,
    };
  };

  prisma.candidateJobMatchState.upsert = async ({ where, create, update, include = {} } = {}) => {
    const existing = state.candidateJobMatchStates.find((item) => (
      item.organisationId === where.organisationId_candidateId_jobId.organisationId
      && item.candidateId === where.organisationId_candidateId_jobId.candidateId
      && item.jobId === where.organisationId_candidateId_jobId.jobId
    ));
    const record = existing
      ? applyData(existing, clone(update))
      : (() => {
          const created = { id: nextId('cjm'), createdAt: now(), updatedAt: now(), ...clone(create) };
          state.candidateJobMatchStates.push(created);
          return created;
        })();
    return {
      ...clone(record),
      latestExecution: include.latestExecution ? clone(state.intelligenceExecutions.find((item) => item.id === record.latestExecutionId) || null) : undefined,
      latestResult: include.latestResult ? {
        ...clone(state.intelligenceResults.find((item) => item.id === record.latestResultId) || null),
        execution: clone(state.intelligenceExecutions.find((item) => item.id === record.latestExecutionId) || null),
      } : undefined,
    };
  };

  prisma.intelligenceExecution.create = async ({ data }) => {
    const execution = {
      id: nextId('exec'),
      createdAt: now(),
      completedAt: null,
      promptTokens: null,
      completionTokens: null,
      estimatedCost: null,
      latencyMs: null,
      ...clone(data),
    };
    state.intelligenceExecutions.push(execution);
    return clone(execution);
  };
  prisma.intelligenceExecution.update = async ({ where, data }) => {
    const execution = state.intelligenceExecutions.find((item) => item.id === where.id);
    applyData(execution, clone(data));
    return clone(execution);
  };
  prisma.intelligenceExecution.count = async ({ where = {} } = {}) => state.intelligenceExecutions.filter((item) => (
    (!where.organisationId || item.organisationId === where.organisationId)
    && (!where.requestedByUserId || item.requestedByUserId === where.requestedByUserId)
    && (!where.feature || item.feature === where.feature)
  )).length;

  prisma.intelligenceResult.findFirst = async ({ where = {}, include = {}, orderBy } = {}) => {
    let rows = state.intelligenceResults.filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.entityType && item.entityType !== where.entityType) return false;
      if (where.entityId && item.entityId !== where.entityId) return false;
      if (where.sourceFingerprint && item.sourceFingerprint !== where.sourceFingerprint) return false;
      if (where.resultVersion && item.resultVersion !== where.resultVersion) return false;
      if (where.promptVersion && item.promptVersion !== where.promptVersion) return false;
      if (where.dismissedAt === null && item.dismissedAt != null) return false;
      if (where.supersededAt === null && item.supersededAt != null) return false;
      return true;
    });
    if (orderBy?.createdAt === 'desc') {
      rows = rows.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    }
    const found = rows[0] || null;
    if (!found) return null;
    return {
      ...clone(found),
      execution: include.execution ? clone(state.intelligenceExecutions.find((item) => item.id === found.executionId) || null) : undefined,
    };
  };
  prisma.intelligenceResult.create = async ({ data }) => {
    const result = {
      id: nextId('result'),
      createdAt: now(),
      supersededAt: null,
      dismissedAt: null,
      expiresAt: null,
      ...clone(data),
    };
    state.intelligenceResults.push(result);
    return clone(result);
  };
  prisma.intelligenceResult.updateMany = async ({ where = {}, data = {} } = {}) => {
    let count = 0;
    for (const item of state.intelligenceResults) {
      if (where.organisationId && item.organisationId !== where.organisationId) continue;
      if (where.entityType && item.entityType !== where.entityType) continue;
      if (where.entityId && item.entityId !== where.entityId) continue;
      if (where.resultVersion && item.resultVersion !== where.resultVersion) continue;
      if (where.supersededAt === null && item.supersededAt != null) continue;
      applyData(item, clone(data));
      count += 1;
    }
    return { count };
  };

  prisma.backgroundTask.findFirst = async ({ where = {} } = {}) => clone(
    state.backgroundTasks.find((item) => (
      (!where.type || item.type === where.type)
      && (!where.entityType || item.entityType === where.entityType)
      && (!where.entityId || item.entityId === where.entityId)
      && (!where.status?.in || where.status.in.includes(item.status))
    )) || null
  );
  prisma.backgroundTask.create = async ({ data }) => {
    const existing = state.backgroundTasks.find((item) => item.idempotencyKey === data.idempotencyKey);
    if (existing) {
      const error = new Error('Unique constraint failed.');
      error.code = 'P2002';
      throw error;
    }
    const task = {
      id: nextId('task'),
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      ...clone(data),
    };
    state.backgroundTasks.push(task);
    return clone(task);
  };
  prisma.backgroundTask.findUnique = async ({ where = {} } = {}) => clone(
    state.backgroundTasks.find((item) => item.id === where.id || item.idempotencyKey === where.idempotencyKey) || null
  );

  prisma.auditLog.create = async ({ data }) => {
    const audit = { id: nextId('audit'), createdAt: now(), ...clone(data) };
    state.auditLogs.push(audit);
    return clone(audit);
  };

  prisma.user.findUnique = async ({ where = {}, include = {} } = {}) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    if (!user) return null;
    return {
      ...clone(user),
      recruiterProfile: include.recruiterProfile ? null : undefined,
      candidateProfile: include.candidateProfile ? null : undefined,
    };
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({
    getCandidateJobMatch,
    getCandidateJobMatchStatus,
    regenerateCandidateJobMatch,
    runCandidateJobMatchGenerationTask,
  } = await import('../intelligence/services/candidateMatchEngineService.js'));
  ({ getCandidateMatchIntelligence } = await import('../intelligence/services/candidateMatchService.js'));
  ({ buildCandidateJobMatchSourceFingerprint } = await import('../intelligence/services/candidateMatchFingerprintService.js'));
  ({ calculateCandidateJobMatchScore } = await import('../intelligence/services/candidateMatchScoringService.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
});

beforeEach(() => {
  seedState();
  installPrismaMocks();
  originalEnv = {
    intelligenceEnabled: env.intelligenceEnabled,
    intelligenceProvider: env.intelligenceProvider,
    intelligenceModel: env.intelligenceModel,
    intelligenceBaseUrl: env.intelligenceBaseUrl,
    intelligenceApiKey: env.intelligenceApiKey,
    awsBedrockModelId: env.awsBedrockModelId,
    intelligenceTimeoutMs: env.intelligenceTimeoutMs,
    intelligenceMaxRetries: env.intelligenceMaxRetries,
    isProduction: env.isProduction,
  };
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'MOCK';
  env.intelligenceModel = 'mock-model';
  env.intelligenceBaseUrl = 'https://example.com';
  env.intelligenceApiKey = 'test-key';
  env.awsBedrockModelId = 'bedrock-model';
  env.intelligenceTimeoutMs = 2500;
  env.intelligenceMaxRetries = 1;
  env.isProduction = false;
  resetIntelligenceProvider();
});

afterEach(() => {
  Object.assign(env, originalEnv);
  resetIntelligenceProvider();
});

function adminActor() {
  return clone(state.users.find((item) => item.id === 'admin-1'));
}

function recruiterActor(id = 'recruiter-1') {
  return clone(state.users.find((item) => item.id === id));
}

test('fingerprint ignores cosmetic candidate fields but changes on meaningful match input changes', () => {
  const candidate = clone(state.candidates[0]);
  const job = clone(state.jobs[0]);
  const resumeAsset = clone(state.resumeAssets[0]);
  const base = buildCandidateJobMatchSourceFingerprint({
    candidate,
    job,
    resumeAsset,
    candidateIntelligenceState: clone(state.candidateIntelligenceStates[0]),
    jobDescriptionState: clone(state.jobDescriptionStates[0]),
    provider: 'MOCK',
    model: 'mock-model',
  });

  candidate.updatedAt = new Date('2026-07-28T12:00:00.000Z');
  candidate.profileViews = 900;
  const same = buildCandidateJobMatchSourceFingerprint({
    candidate,
    job,
    resumeAsset,
    candidateIntelligenceState: clone(state.candidateIntelligenceStates[0]),
    jobDescriptionState: clone(state.jobDescriptionStates[0]),
    provider: 'MOCK',
    model: 'mock-model',
  });

  candidate.skills = [...candidate.skills, 'Kafka'];
  const changed = buildCandidateJobMatchSourceFingerprint({
    candidate,
    job,
    resumeAsset,
    candidateIntelligenceState: clone(state.candidateIntelligenceStates[0]),
    jobDescriptionState: clone(state.jobDescriptionStates[0]),
    provider: 'MOCK',
    model: 'mock-model',
  });

  assert.equal(base, same);
  assert.notEqual(base, changed);
});

test('deterministic scoring centralizes required skill and experience weighting', () => {
  const score = calculateCandidateJobMatchScore(state.candidates[0], state.jobs[0]);

  assert.equal(score.overallScore >= 80, true);
  assert.equal(score.subscores.requiredSkills, 100);
  assert.equal(score.subscores.experience, 100);
  assert.equal(score.recommendation.label, 'STRONG_MATCH');
});

test('stateful get queues async generation and returns pending deterministic baseline', async () => {
  const response = await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  assert.equal(response.execution.status, 'PENDING');
  assert.equal(response.execution.aiEnabled, true);
  assert.equal(response.recruiterSummary.generationType, 'DETERMINISTIC');
  assert.equal(state.backgroundTasks.length, 1);
  assert.equal(state.backgroundTasks[0].type, 'CANDIDATE_MATCH_GENERATION');
});

test('worker generation persists ready result with evidence-backed output', async () => {
  await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  const task = state.backgroundTasks[0];
  const outcome = await runCandidateJobMatchGenerationTask(task);

  assert.equal(outcome, 'success');
  assert.equal(state.intelligenceResults.length, 1);
  assert.equal(state.candidateJobMatchStates[0].status, 'READY');
  assert.ok(state.intelligenceResults[0].normalizedOutput.recruiterSummary.evidence.length >= 1);
  assert.equal(state.intelligenceResults[0].normalizedOutput.recruiterSummary.generationType, 'AI_GENERATED');
});

test('cached match result is reused on subsequent reads', async () => {
  await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });
  await runCandidateJobMatchGenerationTask(state.backgroundTasks[0]);

  const response = await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  assert.equal(response.execution.cacheHit, true);
  assert.equal(response.execution.status, 'READY');
  assert.equal(response.recruiterSummary.generationType, 'AI_GENERATED');
});

test('stale detection marks existing result stale when candidate source changes', async () => {
  await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });
  await runCandidateJobMatchGenerationTask(state.backgroundTasks[0]);

  state.candidates[0].skills = ['Java'];
  const status = await getCandidateJobMatchStatus(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  assert.equal(status.status, 'STALE');
  assert.equal(status.stale, true);
});

test('compatibility service preserves legacy response shape', async () => {
  const response = await getCandidateMatchIntelligence(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  assert.equal(typeof response.executionId, 'string');
  assert.equal(typeof response.deterministic.overallScore, 'number');
  assert.equal(Array.isArray(response.deterministic.matchedCriteria), true);
  assert.equal(typeof response.generatedLabel, 'string');
});

test('regeneration requires generate permission while read is denied for insufficient role', async () => {
  await assert.rejects(
    () => getCandidateJobMatch(recruiterActor('viewer-1'), {
      candidateId: 'candidate-1',
      jobId: 'job-1',
    }),
    (error) => error?.statusCode === 403
  );

  const response = await regenerateCandidateJobMatch(recruiterActor('recruiter-1'), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
    forceRegenerate: true,
  });

  assert.equal(response.queued, true);
});

test('organisation isolation prevents cross-org match access', async () => {
  await assert.rejects(
    () => getCandidateJobMatch(recruiterActor('other-1'), {
      candidateId: 'candidate-1',
      jobId: 'job-1',
    }),
    (error) => error?.statusCode === 404
  );
});

test('AI-disabled match returns deterministic disabled result without queueing provider work', async () => {
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  resetIntelligenceProvider();

  const response = await getCandidateJobMatch(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });

  assert.equal(response.execution.status, 'DISABLED');
  assert.equal(response.execution.aiEnabled, false);
  assert.equal(response.recruiterSummary.generationType, 'DETERMINISTIC');
  assert.equal(state.backgroundTasks.length, 0);
});
