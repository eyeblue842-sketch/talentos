import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let getCandidateIntelligence;
let regenerateCandidateIntelligence;
let runCandidateIntelligenceGenerationTask;
let buildCandidateIntelligenceSourceFingerprint;
let normalizeSkillName;
let resetIntelligenceProvider;
let createBedrockProvider;

let state;
let idCounter = 1;
let originalEnv = {};
let originalBedrockSend;

function now() {
  return new Date('2026-07-27T10:00:00.000Z');
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
      { id: 'recruiter-2', role: 'RECRUITER', email: 'r2@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'recruiter-3', role: 'RECRUITER', email: 'r3@careeriz.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-2', userId: 'recruiter-2', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'recruiter-3', role: 'INTERVIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.candidate_intelligence', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-2', organisationId: 'org-2', key: 'intelligence.candidate_intelligence', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    candidates: [
      {
        id: 'candidate-1',
        organisationId: 'org-1',
        fullName: 'Candidate Person',
        headline: 'Senior Engineer',
        currentTitle: 'Senior Engineer',
        currentEmployer: 'Acme Labs',
        currentDesignation: 'Senior Engineer',
        location: 'Bangalore',
        totalExperience: 7,
        summary: 'Built production systems with React and Spring Boot.',
        skills: ['ReactJS', 'SpringBoot', 'AWS'],
        functionalSkills: [],
        tools: ['Docker'],
        frameworks: ['Spring Framework'],
        cloudPlatforms: ['AWS Cloud'],
        databases: ['Postgres'],
        softSkills: ['Mentoring'],
        preferredRoles: ['Engineering Lead'],
        preferredLocations: ['Bangalore'],
        employmentPreferences: ['FULL_TIME'],
        workplacePreferences: ['HYBRID'],
        noticePeriodDays: 30,
        skillEntries: [],
        experienceEntries: [{ company: 'Acme Labs', title: 'Senior Engineer', startDate: '2022-01-01', currentlyWorking: true }],
        educationEntries: [{ institution: 'VTU', degree: 'B.Tech', completionYear: 2019 }],
        certificationEntries: [],
        languageEntries: [],
        projectEntries: [],
        portfolioLinks: [],
        linkedInUrlNormalized: 'linkedin.com/in/candidate',
        githubUrl: 'https://github.com/candidate',
        portfolioUrl: null,
        parserVersion: 'parser-v1',
        rawResumeText: null,
        latestResumeAssetId: 'resume-1',
        updatedAt: now(),
        createdAt: now(),
        profileViews: 10,
      },
    ],
    resumeAssets: [
      {
        id: 'resume-1',
        candidateId: 'candidate-1',
        source: 'UPLOAD',
        originalFilename: 'candidate.pdf',
        parsingStatus: 'PARTIAL',
        parsedText: 'Candidate Person Senior Engineer React Spring Boot AWS',
        parsedData: { parser: 'resume-parser-v1', suggestedUpdates: { skills: ['React', 'Spring Boot'] } },
        externalResumeVersion: null,
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    importItems: [
      {
        id: 'import-1',
        organisationId: 'org-1',
        candidateId: 'candidate-1',
        parserVersion: 'import-parser-v1',
        parsedData: { candidate: { skills: { value: ['AWS', 'NodeJS'] } } },
        updatedAt: now(),
      },
    ],
    intelligenceExecutions: [],
    intelligenceResults: [],
    candidateIntelligenceStates: [],
    backgroundTasks: [],
    auditLogs: [],
  };
}

function attachRelations(candidate) {
  if (!candidate) return null;
  return {
    ...clone(candidate),
    latestResumeAsset: clone(state.resumeAssets.find((item) => item.id === candidate.latestResumeAssetId) || null),
    importedFromItems: state.importItems
      .filter((item) => item.candidateId === candidate.id)
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 1)
      .map(clone),
  };
}

function installPrismaMocks() {
  prisma.organisation.findFirst = async ({ where = {} } = {}) => clone(
    state.organisations.find((item) => (!where.id || item.id === where.id) && (!where.status || item.status === where.status)) || null
  );

  prisma.organisationMembership.findMany = async ({ where = {}, include = {} } = {}) => state.memberships
    .filter((item) => (!where.userId || item.userId === where.userId) && (!where.status || item.status === where.status))
    .map((item) => ({
      ...clone(item),
      organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId)) : undefined,
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
    return attachRelations(found);
  };
  prisma.candidateProfile.findUnique = async ({ where = {} } = {}) => attachRelations(
    state.candidates.find((item) => item.id === where.id) || null
  );

  prisma.candidateIntelligenceState.findUnique = async ({ where = {}, include = {} } = {}) => {
    const found = state.candidateIntelligenceStates.find((item) => (
      item.organisationId === where.organisationId_candidateId_kind.organisationId
      && item.candidateId === where.organisationId_candidateId_kind.candidateId
      && item.kind === where.organisationId_candidateId_kind.kind
    )) || null;
    if (!found) return null;
    return {
      ...clone(found),
      latestExecution: include.latestExecution ? clone(state.intelligenceExecutions.find((item) => item.id === found.latestExecutionId) || null) : undefined,
      latestResult: include.latestResult ? clone(state.intelligenceResults.find((item) => item.id === found.latestResultId) || null) : undefined,
    };
  };
  prisma.candidateIntelligenceState.upsert = async ({ where, create, update, include = {} } = {}) => {
    const existing = state.candidateIntelligenceStates.find((item) => (
      item.organisationId === where.organisationId_candidateId_kind.organisationId
      && item.candidateId === where.organisationId_candidateId_kind.candidateId
      && item.kind === where.organisationId_candidateId_kind.kind
    ));
    const record = existing
      ? Object.assign(existing, clone(update), { updatedAt: now() })
      : (() => {
          const created = { id: nextId('cis'), createdAt: now(), updatedAt: now(), ...clone(create) };
          state.candidateIntelligenceStates.push(created);
          return created;
        })();
    return {
      ...clone(record),
      latestExecution: include.latestExecution ? clone(state.intelligenceExecutions.find((item) => item.id === record.latestExecutionId) || null) : undefined,
      latestResult: include.latestResult ? clone(state.intelligenceResults.find((item) => item.id === record.latestResultId) || null) : undefined,
    };
  };
  prisma.candidateIntelligenceState.updateMany = async ({ where = {}, data = {} } = {}) => {
    let count = 0;
    for (const item of state.candidateIntelligenceStates) {
      if (where.candidateId && item.candidateId !== where.candidateId) continue;
      Object.assign(item, clone(data), { updatedAt: now() });
      count += 1;
    }
    return { count };
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
    Object.assign(execution, clone(data));
    return clone(execution);
  };

  prisma.intelligenceResult.findFirst = async ({ where = {}, include = {}, orderBy } = {}) => {
    let rows = state.intelligenceResults.filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.entityType && item.entityType !== where.entityType) return false;
      if (where.entityId && item.entityId !== where.entityId) return false;
      if (where.sourceFingerprint && item.sourceFingerprint !== where.sourceFingerprint) return false;
      if (where.resultVersion && item.resultVersion !== where.resultVersion) return false;
      if (where.promptVersion && item.promptVersion !== where.promptVersion) return false;
      if (where.supersededAt === null && item.supersededAt != null) return false;
      if (where.dismissedAt === null && item.dismissedAt != null) return false;
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
      Object.assign(item, clone(data));
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
      const error = new Error('Duplicate background task.');
      error.code = 'P2002';
      throw error;
    }
    const task = { id: nextId('task'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.backgroundTasks.push(task);
    return clone(task);
  };
  prisma.backgroundTask.findUnique = async ({ where = {} } = {}) => clone(
    state.backgroundTasks.find((item) => item.idempotencyKey === where.idempotencyKey || item.id === where.id) || null
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
    getCandidateIntelligence,
    regenerateCandidateIntelligence,
    runCandidateIntelligenceGenerationTask,
    buildCandidateIntelligenceSourceFingerprint,
    normalizeSkillName,
  } = await import('../intelligence/services/candidateIntelligenceService.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
  ({ createBedrockProvider } = await import('../intelligence/providers/bedrockProvider.js'));
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
  if (originalBedrockSend) {
    originalBedrockSend.owner.prototype.send = originalBedrockSend.value;
    originalBedrockSend = null;
  }
});

function adminActor() {
  return clone(state.users.find((item) => item.id === 'admin-1'));
}

function recruiterActor(userId) {
  return clone(state.users.find((item) => item.id === userId));
}

test('skill normalization canonicalizes common technology aliases', () => {
  assert.equal(normalizeSkillName('SpringBoot'), 'Spring Boot');
  assert.equal(normalizeSkillName('nodejs'), 'Node.js');
  assert.equal(normalizeSkillName('AWS Cloud'), 'AWS');
});

test('source fingerprint ignores cosmetic candidate fields', () => {
  const candidate = clone(state.candidates[0]);
  const resume = clone(state.resumeAssets[0]);
  const importItem = clone(state.importItems[0]);
  const base = buildCandidateIntelligenceSourceFingerprint(candidate, resume, importItem, 'import-parser-v1');

  candidate.profileViews = 999;
  candidate.updatedAt = new Date('2026-07-27T11:00:00.000Z');
  const next = buildCandidateIntelligenceSourceFingerprint(candidate, resume, importItem, 'import-parser-v1');

  assert.equal(base, next);
});

test('AI-disabled reads return deterministic baseline and persist a disabled cached result', async () => {
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  resetIntelligenceProvider();

  const response = await getCandidateIntelligence(adminActor(), { candidateId: 'candidate-1' });

  assert.equal(response.execution.aiEnabled, false);
  assert.equal(response.execution.status, 'DISABLED');
  assert.equal(response.summary.professionalSummary.generationType, 'DETERMINISTIC');
  assert.equal(state.intelligenceResults.length, 1);
  assert.equal(state.candidateIntelligenceStates[0].status, 'DISABLED');
});

test('cached candidate intelligence is reused without enqueueing a duplicate task', async () => {
  const candidate = state.candidates[0];
  const fingerprint = buildCandidateIntelligenceSourceFingerprint(candidate, state.resumeAssets[0], state.importItems[0], 'import-parser-v1');

  state.intelligenceExecutions.push({
    id: 'exec-1',
    organisationId: 'org-1',
    provider: 'MOCK',
    model: 'mock-model',
    status: 'SUCCEEDED',
    promptVersion: '1.0.0',
    createdAt: now(),
    completedAt: now(),
  });
  state.intelligenceResults.push({
    id: 'result-1',
    organisationId: 'org-1',
    executionId: 'exec-1',
    entityType: 'CandidateIntelligence',
    entityId: 'candidate-1',
    sourceFingerprint: fingerprint,
    resultVersion: 'candidate-intelligence-v1',
    promptVersion: '1.0.0',
    normalizedOutput: {
      summary: { professionalSummary: { text: 'Cached', confidence: { score: 0.7, label: 'MEDIUM' }, evidence: [{ id: 'e1' }], generationType: 'AI_GENERATED' }, roleThemes: [] },
      snapshot: {},
      skills: { normalized: [], keywordClusters: [] },
      timeline: [],
      strengths: [],
      developmentAreas: [],
      recommendedRoles: [],
      missingInformation: [],
      profileCompleteness: { score: 80, label: 'HIGH', missingFields: [] },
      confidence: { overallScore: 0.7, overallLabel: 'MEDIUM', deterministicCoverage: 1, aiSignalCount: 1 },
      quality: { score: 82, label: 'HIGH' },
      warnings: [],
    },
    createdAt: now(),
    supersededAt: null,
    dismissedAt: null,
    expiresAt: null,
  });

  const response = await getCandidateIntelligence(adminActor(), { candidateId: 'candidate-1' });

  assert.equal(response.execution.cacheHit, true);
  assert.equal(response.execution.status, 'READY');
  assert.equal(state.backgroundTasks.length, 0);
});

test('meaningful candidate changes mark intelligence stale and queue regeneration', async () => {
  const candidate = state.candidates[0];
  const oldCandidate = { ...clone(candidate), summary: 'Old summary' };
  const staleFingerprint = buildCandidateIntelligenceSourceFingerprint(oldCandidate, state.resumeAssets[0], state.importItems[0], 'import-parser-v1');

  state.intelligenceExecutions.push({
    id: 'exec-1',
    organisationId: 'org-1',
    provider: 'MOCK',
    model: 'mock-model',
    status: 'SUCCEEDED',
    promptVersion: '1.0.0',
    createdAt: now(),
    completedAt: now(),
  });
  state.intelligenceResults.push({
    id: 'result-1',
    organisationId: 'org-1',
    executionId: 'exec-1',
    entityType: 'CandidateIntelligence',
    entityId: 'candidate-1',
    sourceFingerprint: staleFingerprint,
    resultVersion: 'candidate-intelligence-v1',
    promptVersion: '1.0.0',
    normalizedOutput: {
      summary: { professionalSummary: { text: 'Old summary', confidence: { score: 0.7, label: 'MEDIUM' }, evidence: [{ id: 'e1' }], generationType: 'AI_GENERATED' }, roleThemes: [] },
      snapshot: {},
      skills: { normalized: [], keywordClusters: [] },
      timeline: [],
      strengths: [],
      developmentAreas: [],
      recommendedRoles: [],
      missingInformation: [],
      profileCompleteness: { score: 75, label: 'MEDIUM', missingFields: [] },
      confidence: { overallScore: 0.7, overallLabel: 'MEDIUM', deterministicCoverage: 1, aiSignalCount: 1 },
      quality: { score: 76, label: 'MEDIUM' },
      warnings: [],
    },
    createdAt: now(),
    supersededAt: null,
    dismissedAt: null,
    expiresAt: null,
  });

  const response = await getCandidateIntelligence(adminActor(), { candidateId: 'candidate-1' });

  assert.equal(response.execution.stale, true);
  assert.equal(response.execution.status, 'STALE');
  assert.equal(state.backgroundTasks.length, 1);
  assert.equal(state.backgroundTasks[0].type, 'CANDIDATE_INTELLIGENCE_GENERATION');
});

test('candidate intelligence generation respects permissions and organisation isolation', async () => {
  await assert.rejects(
    () => regenerateCandidateIntelligence(recruiterActor('recruiter-3'), { candidateId: 'candidate-1', forceRegenerate: true }),
    /Insufficient organisation permissions/i,
  );

  await assert.rejects(
    () => getCandidateIntelligence(recruiterActor('recruiter-2'), { candidateId: 'candidate-1' }),
    /Candidate not found/i,
  );
});

test('mock provider generation stores evidence-backed structured output without raw provider payloads', async () => {
  const task = {
    id: 'task-1',
    type: 'CANDIDATE_INTELLIGENCE_GENERATION',
    entityId: 'candidate-1',
    attemptCount: 1,
    payload: {
      candidateId: 'candidate-1',
      requestedByUserId: 'admin-1',
      kind: 'PROFILE_OVERVIEW',
    },
  };

  const result = await runCandidateIntelligenceGenerationTask(task);

  assert.equal(result, 'success');
  const stored = state.intelligenceResults[0];
  assert.ok(stored);
  assert.equal(stored.normalizedOutput.summary.professionalSummary.generationType, 'AI_GENERATED');
  assert.ok(stored.normalizedOutput.strengths[0].evidence.length >= 1);
  assert.ok(stored.normalizedOutput.recommendedRoles[0].evidence.length >= 1);
  assert.equal('rawText' in stored.normalizedOutput, false);
  assert.equal('evidenceIds' in stored.normalizedOutput.strengths[0], false);
  assert.ok(typeof stored.normalizedOutput.quality.score === 'number');
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(stored.normalizedOutput.quality.label));
});

test('bedrock provider adapts structured JSON responses safely', async () => {
  const sdk = await import('@aws-sdk/client-bedrock-runtime');
  originalBedrockSend = { owner: sdk.BedrockRuntimeClient, value: sdk.BedrockRuntimeClient.prototype.send };
  sdk.BedrockRuntimeClient.prototype.send = async () => ({
    body: new TextEncoder().encode(JSON.stringify({
      outputText: JSON.stringify({ ok: true, nested: { value: 1 } }),
      usage: { inputTokens: 12, outputTokens: 8 },
    })),
  });

  const provider = createBedrockProvider();
  const generated = await provider.generate({
    prompt: 'Return JSON',
    schema: { type: 'object' },
    settings: { model: 'bedrock-model' },
  });

  assert.equal(generated.model, 'bedrock-model');
  assert.equal(generated.promptTokens, 12);
  assert.equal(generated.completionTokens, 8);
  assert.match(generated.text, /"ok":true/);
});
