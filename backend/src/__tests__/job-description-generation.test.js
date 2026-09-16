import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let getJobDescription;
let getJobDescriptionStatus;
let regenerateJobDescription;
let runJobDescriptionGenerationTask;
let buildJobDescriptionSourceFingerprint;
let applyAuthoritativeJobFacts;
let getJobIntelligence;
let serializePublicJob;
let listJobDescriptionDrafts;
let getJobDescriptionDraft;
let createJobDescriptionDraft;
let updateJobDescriptionDraft;
let applyJobDescriptionDraft;
let listJobDescriptionTemplates;
let createJobDescriptionTemplate;
let getJobDescriptionTemplate;
let createJobDescriptionTemplateVersion;
let activateJobDescriptionTemplate;
let getJobDescriptionHistory;
let resetIntelligenceProvider;

let state;
let idCounter = 1;
let originalEnv = {};
const originalFetch = global.fetch;
const allowedExecutionStatuses = new Set(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED']);

function now() {
  return new Date('2026-07-28T10:00:00.000Z');
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function seedState() {
  idCounter = 1;
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'admin-1', role: 'ADMIN', email: 'admin@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'recruiter-1', role: 'RECRUITER', email: 'recruiter@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'viewer-1', role: 'RECRUITER', email: 'viewer@careeriz.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
      { id: 'membership-2', organisationId: 'org-1', userId: 'viewer-1', role: 'VIEWER', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.job_description', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    requisitions: [
      {
        id: 'req-1',
        organisationId: 'org-1',
        title: 'Senior Backend Engineer',
        department: 'Engineering',
        businessUnit: 'Platform',
        location: 'Bangalore',
        employmentType: 'FULL_TIME',
        numberOfOpenings: 2,
        reasonForHiring: 'Scale backend hiring for the payments platform.',
        priority: 'HIGH',
        budgetMin: 20,
        budgetMax: 35,
        updatedAt: now(),
      },
    ],
    jobs: [
      {
        id: 'job-1',
        organisationId: 'org-1',
        recruiterId: 'recruiter-1',
        requisitionId: 'req-1',
        hiringManagerId: null,
        title: 'Senior Backend Engineer',
        slug: 'senior-backend-engineer',
        description: 'Build reliable backend services with Java, Spring Boot, and AWS.',
        skillsRequired: ['Java', 'Spring Boot', 'AWS'],
        responsibilities: ['Own backend services', 'Collaborate with product partners'],
        requirements: ['5+ years experience'],
        benefits: ['Health insurance'],
        experienceMin: 5,
        experienceMax: 9,
        location: 'Bangalore',
        employmentType: 'FULL_TIME',
        workplaceType: 'HYBRID',
        department: 'Engineering',
        businessUnit: 'Platform',
        targetHires: 2,
        status: 'DRAFT',
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    intelligenceExecutions: [],
    intelligenceResults: [],
    jobDescriptionStates: [],
    jobDescriptionDrafts: [],
    jobDescriptionTemplates: [
      {
        id: 'tmpl-system-1',
        organisationId: null,
        scope: 'SYSTEM',
        key: 'backend_default',
        name: 'Backend Default',
        description: 'System template',
        isActive: true,
        activeVersionId: 'tmpl-ver-system-1',
        createdByUserId: 'admin-1',
        updatedByUserId: 'admin-1',
        activatedByUserId: 'admin-1',
        activatedAt: now(),
        archivedAt: null,
        metadata: null,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    jobDescriptionTemplateVersions: [
      {
        id: 'tmpl-ver-system-1',
        templateId: 'tmpl-system-1',
        version: 1,
        title: 'Backend JD',
        content: {
          title: 'Senior Backend Engineer',
          summary: 'System template summary.',
          responsibilities: ['Build services'],
          requiredQualifications: ['Java'],
          preferredQualifications: ['Kafka'],
          screeningQuestions: [],
          assumptions: [],
          exclusionaryWordingWarnings: [],
          missingFields: [],
          interviewFocus: [],
        },
        schemaVersion: '1.0.0',
        promptKey: 'JOB_DESCRIPTION_FULL',
        promptVersion: '1.0.0',
        sourceResultId: null,
        metadata: null,
        createdByUserId: 'admin-1',
        createdAt: now(),
      },
    ],
    backgroundTasks: [],
    auditLogs: [],
  };
}

function withJobRelations(job) {
  if (!job) return null;
  return {
    ...clone(job),
    requisition: clone(state.requisitions.find((item) => item.id === job.requisitionId) || null),
  };
}

function withTemplateRelations(template, include = {}) {
  if (!template) return null;
  return {
    ...clone(template),
    versions: include.versions
      ? state.jobDescriptionTemplateVersions
          .filter((item) => item.templateId === template.id)
          .sort((left, right) => right.version - left.version)
          .map(clone)
      : undefined,
    activeVersion: include.activeVersion
      ? clone(state.jobDescriptionTemplateVersions.find((item) => item.id === template.activeVersionId) || null)
      : undefined,
  };
}

function installPrismaMocks() {
  prisma.organisation ||= {};
  prisma.organisationMembership ||= {};
  prisma.featureFlag ||= {};
  prisma.job ||= {};
  prisma.jobRequisition ||= {};
  prisma.jobDescriptionState ||= {};
  prisma.jobDescriptionDraft ||= {};
  prisma.jobDescriptionTemplate ||= {};
  prisma.jobDescriptionTemplateVersion ||= {};
  prisma.backgroundTask ||= {};
  prisma.intelligenceExecution ||= {};
  prisma.intelligenceResult ||= {};
  prisma.user ||= {};
  prisma.auditLog ||= {};

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

  // Needed by jobService.ensureOrganisationMember (used whenever
  // createJob/updateJob/updateJobStatus re-validates the assigned
  // recruiter/hiring manager - including the status-transition path that
  // applyJobDescriptionDraft now goes through instead of writing job.status
  // directly, see B1 hardening section 4).
  prisma.organisationMembership.findFirst = async ({ where = {}, include = {} } = {}) => {
    const match = state.memberships.find((item) => item.organisationId === where.organisationId
      && item.userId === where.userId
      && item.status === where.status
      && (!where.role?.in || where.role.in.includes(item.role)));
    if (!match) return null;
    return {
      ...clone(match),
      user: include.user ? clone(state.users.find((user) => user.id === match.userId) || null) : undefined,
    };
  };
  // jobService.createJob/updateJob/updateJobStatus always run inside
  // $transaction - pass the same mocked prisma through as `tx` rather than
  // opening a real transaction against the shared test database.
  prisma.$transaction = async (callback) => callback(prisma);

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

  prisma.job.findUnique = async ({ where = {} } = {}) => withJobRelations(
    state.jobs.find((item) => item.id === where.id) || null
  );
  prisma.job.findFirst = async ({ where = {} } = {}) => withJobRelations(
    state.jobs.find((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId)) || null
  );
  prisma.job.update = async ({ where = {}, data = {} } = {}) => {
    const record = state.jobs.find((item) => item.id === where.id);
    Object.assign(record, clone(data), { updatedAt: now() });
    return withJobRelations(record);
  };

  prisma.jobRequisition.findFirst = async ({ where = {} } = {}) => clone(
    state.requisitions.find((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId)) || null
  );

  prisma.jobDescriptionState.findUnique = async ({ where = {}, include = {} } = {}) => {
    const found = state.jobDescriptionStates.find((item) => (
      item.organisationId === where.organisationId_jobId_kind.organisationId
      && item.jobId === where.organisationId_jobId_kind.jobId
      && item.kind === where.organisationId_jobId_kind.kind
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
  prisma.jobDescriptionState.upsert = async ({ where, create, update, include = {} } = {}) => {
    const existing = state.jobDescriptionStates.find((item) => (
      item.organisationId === where.organisationId_jobId_kind.organisationId
      && item.jobId === where.organisationId_jobId_kind.jobId
      && item.kind === where.organisationId_jobId_kind.kind
    ));
    const record = existing
      ? Object.assign(existing, clone(update), { updatedAt: now() })
      : (() => {
          const created = { id: nextId('jds'), createdAt: now(), updatedAt: now(), ...clone(create) };
          state.jobDescriptionStates.push(created);
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
  prisma.jobDescriptionDraft.findMany = async ({ where = {}, orderBy = [] } = {}) => {
    let results = state.jobDescriptionDrafts.filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.jobId && item.jobId !== where.jobId) return false;
      if (where.isLatestVersion !== undefined && item.isLatestVersion !== where.isLatestVersion) return false;
      if (where.versionGroupId && item.versionGroupId !== where.versionGroupId) return false;
      return true;
    });
    for (const clause of [...orderBy].reverse()) {
      const [[field, direction]] = Object.entries(clause);
      results = results.sort((left, right) => {
        const leftValue = left[field];
        const rightValue = right[field];
        return direction === 'desc'
          ? (leftValue < rightValue ? 1 : leftValue > rightValue ? -1 : 0)
          : (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0);
      });
    }
    return results.map(clone);
  };
  prisma.jobDescriptionDraft.findFirst = async ({ where = {}, orderBy = [] } = {}) => {
    const results = await prisma.jobDescriptionDraft.findMany({ where, orderBy });
    return results[0] || null;
  };
  prisma.jobDescriptionDraft.findUnique = async ({ where = {}, include = {} } = {}) => {
    const found = state.jobDescriptionDrafts.find((item) => item.id === where.id) || null;
    if (!found) return null;
    return {
      ...clone(found),
      job: include.job ? withJobRelations(state.jobs.find((item) => item.id === found.jobId) || null) : undefined,
    };
  };
  prisma.jobDescriptionDraft.create = async ({ data = {} } = {}) => {
    const created = {
      id: nextId('draft'),
      createdAt: now(),
      updatedAt: now(),
      approvedAt: null,
      approvedByUserId: null,
      appliedAt: null,
      appliedByUserId: null,
      appliedJobSnapshot: null,
      previousVersionId: null,
      jobSnapshot: null,
      sourceStateId: null,
      sourceExecutionId: null,
      sourceResultId: null,
      templateId: null,
      templateVersionId: null,
      createdByUserId: null,
      updatedByUserId: null,
      ...clone(data),
    };
    state.jobDescriptionDrafts.push(created);
    return clone(created);
  };
  prisma.jobDescriptionDraft.update = async ({ where = {}, data = {} } = {}) => {
    const record = state.jobDescriptionDrafts.find((item) => item.id === where.id);
    Object.assign(record, clone(data), { updatedAt: now() });
    return clone(record);
  };
  prisma.jobDescriptionTemplate.findMany = async ({ where = {}, include = {}, orderBy = [] } = {}) => {
    let results = state.jobDescriptionTemplates.filter((item) => {
      if (!where.OR) return true;
      return where.OR.some((condition) => {
        if (condition.scope && item.scope === condition.scope) return true;
        if (condition.organisationId && item.organisationId === condition.organisationId) return true;
        return false;
      });
    });
    for (const clause of [...orderBy].reverse()) {
      const [[field, direction]] = Object.entries(clause);
      results = results.sort((left, right) => {
        const leftValue = left[field];
        const rightValue = right[field];
        return direction === 'desc'
          ? (leftValue < rightValue ? 1 : leftValue > rightValue ? -1 : 0)
          : (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0);
      });
    }
    return results.map((item) => withTemplateRelations(item, include));
  };
  prisma.jobDescriptionTemplate.findUnique = async ({ where = {}, include = {} } = {}) => withTemplateRelations(
    state.jobDescriptionTemplates.find((item) => item.id === where.id) || null,
    include,
  );
  prisma.jobDescriptionTemplate.create = async ({ data = {} } = {}) => {
    const created = {
      id: nextId('template'),
      createdAt: now(),
      updatedAt: now(),
      organisationId: null,
      scope: 'ORGANISATION',
      description: null,
      isActive: true,
      activeVersionId: null,
      createdByUserId: null,
      updatedByUserId: null,
      activatedByUserId: null,
      activatedAt: null,
      archivedAt: null,
      metadata: null,
      ...clone(data),
    };
    state.jobDescriptionTemplates.push(created);
    return clone(created);
  };
  prisma.jobDescriptionTemplate.update = async ({ where = {}, data = {}, include = {} } = {}) => {
    const record = state.jobDescriptionTemplates.find((item) => item.id === where.id);
    Object.assign(record, clone(data), { updatedAt: now() });
    return withTemplateRelations(record, include);
  };
  prisma.jobDescriptionTemplateVersion.create = async ({ data = {} } = {}) => {
    const created = {
      id: nextId('tmplver'),
      createdAt: now(),
      sourceResultId: null,
      metadata: null,
      createdByUserId: null,
      ...clone(data),
    };
    state.jobDescriptionTemplateVersions.push(created);
    return clone(created);
  };

  prisma.backgroundTask.findFirst = async ({ where = {} } = {}) => clone(
    state.backgroundTasks.find((item) => (
      (!where.type || item.type === where.type)
      && (!where.entityType || item.entityType === where.entityType)
      && (!where.entityId || item.entityId === where.entityId)
      && (!where.status?.in || where.status.in.includes(item.status))
    )) || null
  );
  prisma.backgroundTask.create = async ({ data } = {}) => {
    const existing = state.backgroundTasks.find((item) => item.idempotencyKey === data.idempotencyKey);
    if (existing) {
      const error = new Error('Unique constraint failed.');
      error.code = 'P2002';
      throw error;
    }
    const created = { id: nextId('task'), createdAt: now(), updatedAt: now(), completedAt: null, lastAttemptAt: null, nextAttemptAt: null, ...clone(data) };
    state.backgroundTasks.push(created);
    return clone(created);
  };
  prisma.backgroundTask.findUnique = async ({ where = {} } = {}) => clone(
    state.backgroundTasks.find((item) => item.idempotencyKey === where.idempotencyKey || item.id === where.id) || null
  );

  prisma.intelligenceExecution.create = async ({ data } = {}) => {
    assert.equal(allowedExecutionStatuses.has(data.status || 'PENDING'), true, `Unexpected intelligence execution status ${data.status}`);
    const created = {
      id: nextId('exec'),
      createdAt: now(),
      completedAt: null,
      outputCharacterCount: 0,
      promptTokens: null,
      completionTokens: null,
      estimatedCost: null,
      latencyMs: null,
      errorCode: null,
      humanReviewed: false,
      cacheHit: false,
      retries: 0,
      ...clone(data),
    };
    state.intelligenceExecutions.push(created);
    return clone(created);
  };
  prisma.intelligenceExecution.update = async ({ where = {}, data = {} } = {}) => {
    if (data.status !== undefined) {
      assert.equal(allowedExecutionStatuses.has(data.status), true, `Unexpected intelligence execution status ${data.status}`);
    }
    const record = state.intelligenceExecutions.find((item) => item.id === where.id);
    Object.assign(record, clone(data));
    return clone(record);
  };
  prisma.intelligenceExecution.count = async ({ where = {} } = {}) => state.intelligenceExecutions.filter((item) => {
    if (where.organisationId && item.organisationId !== where.organisationId) return false;
    if (where.requestedByUserId && item.requestedByUserId !== where.requestedByUserId) return false;
    if (where.feature && item.feature !== where.feature) return false;
    return true;
  }).length;

  prisma.intelligenceResult.findFirst = async ({ where = {}, include = {} } = {}) => {
    const matched = state.intelligenceResults
      .filter((item) => {
        if (where.organisationId && item.organisationId !== where.organisationId) return false;
        if (where.entityType && item.entityType !== where.entityType) return false;
        if (where.entityId && item.entityId !== where.entityId) return false;
        if (where.sourceFingerprint && item.sourceFingerprint !== where.sourceFingerprint) return false;
        if (where.resultVersion && item.resultVersion !== where.resultVersion) return false;
        if (where.promptVersion && item.promptVersion !== where.promptVersion) return false;
        if (where.dismissedAt === null && item.dismissedAt != null) return false;
        if (where.supersededAt === null && item.supersededAt != null) return false;
        return true;
      })
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    const item = matched[0] || null;
    if (!item) return null;
    return {
      ...clone(item),
      execution: include.execution ? clone(state.intelligenceExecutions.find((entry) => entry.id === item.executionId) || null) : undefined,
    };
  };
  prisma.intelligenceResult.create = async ({ data } = {}) => {
    const created = { id: nextId('result'), createdAt: now(), dismissedAt: null, expiresAt: null, supersededAt: null, isMachineGenerated: true, ...clone(data) };
    state.intelligenceResults.push(created);
    return clone(created);
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
  prisma.intelligenceResult.findMany = async ({ where = {}, include = {}, orderBy } = {}) => {
    let results = state.intelligenceResults.filter((item) => {
      if (where.organisationId && item.organisationId !== where.organisationId) return false;
      if (where.entityType && item.entityType !== where.entityType) return false;
      if (where.entityId && item.entityId !== where.entityId) return false;
      if (where.resultVersion && item.resultVersion !== where.resultVersion) return false;
      return true;
    });
    if (orderBy?.createdAt) {
      results = results.sort((left, right) => orderBy.createdAt === 'desc'
        ? new Date(right.createdAt) - new Date(left.createdAt)
        : new Date(left.createdAt) - new Date(right.createdAt));
    }
    return results.map((item) => ({
      ...clone(item),
      execution: include.execution ? clone(state.intelligenceExecutions.find((entry) => entry.id === item.executionId) || null) : undefined,
    }));
  };

  prisma.user.findUnique = async ({ where = {} } = {}) => clone(
    state.users.find((item) => item.id === where.id) || null
  );

  prisma.auditLog.create = async ({ data } = {}) => {
    const created = { id: nextId('audit'), createdAt: now(), ...clone(data) };
    state.auditLogs.push(created);
    return clone(created);
  };
}

function adminActor() {
  return clone(state.users.find((item) => item.id === 'admin-1'));
}

function recruiterActor() {
  return clone(state.users.find((item) => item.id === 'recruiter-1'));
}

function viewerActor() {
  return clone(state.users.find((item) => item.id === 'viewer-1'));
}

function validAiJobDescription(overrides = {}) {
  return {
    openingSummary: 'Build reliable backend services for the payments platform.',
    roleOverview: 'This Senior Backend Engineer role builds reliable backend services for the payments platform. The engineer will collaborate with product partners and support operational quality for backend services.',
    keyResponsibilities: [
      'Own backend services for payments workflows.',
      'Collaborate with product partners on reliable delivery.',
      'Troubleshoot operational issues in production services.',
    ],
    requiredQualifications: ['Java', 'Spring Boot', 'AWS'],
    preferredQualifications: [],
    additionalSections: [],
    screeningQuestions: [],
    assumptions: [],
    exclusionaryWordingWarnings: [],
    missingFields: [],
    interviewFocus: [],
    ...overrides,
  };
}

function installOpenAiMockResponse(output) {
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-4o';
  env.intelligenceBaseUrl = 'https://api.openai.test/v1';
  env.intelligenceApiKey = 'test-key';
  env.intelligenceMaxRetries = 0;
  resetIntelligenceProvider();

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      model: 'gpt-4o',
      choices: [{
        message: { content: JSON.stringify(output) },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    }),
  });
}

function generationTask(id = 'task-1') {
  return {
    id,
    organisationId: 'org-1',
    entityType: 'Job',
    entityId: 'job-1',
    payload: { jobId: 'job-1', requestedByUserId: 'recruiter-1' },
    createdByUserId: 'recruiter-1',
    attemptCount: 1,
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({
    getJobDescription,
    getJobDescriptionStatus,
    regenerateJobDescription,
    runJobDescriptionGenerationTask,
    buildJobDescriptionSourceFingerprint,
    applyAuthoritativeJobFacts,
  } = await import('../intelligence/services/jobDescriptionGenerationService.js'));
  ({
    listJobDescriptionDrafts,
    getJobDescriptionDraft,
    createJobDescriptionDraft,
    updateJobDescriptionDraft,
    applyJobDescriptionDraft,
    listJobDescriptionTemplates,
    createJobDescriptionTemplate,
    getJobDescriptionTemplate,
    createJobDescriptionTemplateVersion,
    activateJobDescriptionTemplate,
    getJobDescriptionHistory,
  } = await import('../intelligence/services/jobDescriptionManagementService.js'));
  ({ getJobIntelligence } = await import('../intelligence/services/jobIntelligenceService.js'));
  ({ serializePublicJob } = await import('../serializers/index.js'));
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
  global.fetch = originalFetch;
  Object.assign(env, originalEnv);
  resetIntelligenceProvider();
});

test('job description fingerprint ignores cosmetic job fields', () => {
  const job = clone(state.jobs[0]);
  const requisition = clone(state.requisitions[0]);
  const base = buildJobDescriptionSourceFingerprint(job, requisition);

  job.updatedAt = new Date('2026-07-28T11:00:00.000Z');
  job.recruiterId = 'different-user';
  const next = buildJobDescriptionSourceFingerprint(job, requisition);

  assert.equal(base, next);
});

test('AI-disabled reads return deterministic baseline and persist disabled state', async () => {
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  resetIntelligenceProvider();

  const response = await getJobDescription(adminActor(), { jobId: 'job-1' });

  assert.equal(response.execution.status, 'DISABLED');
  assert.equal(response.execution.provider, 'DISABLED');
  assert.equal(response.openingSummary, 'Build reliable backend services with Java, Spring Boot, and AWS.');
  assert.equal(state.jobDescriptionStates[0].status, 'DISABLED');
  assert.equal(state.intelligenceResults.length, 1);
});

test('cached job description result is reused without enqueueing a duplicate task', async () => {
  state.intelligenceExecutions.push({
    id: 'exec-1',
    organisationId: 'org-1',
    feature: 'JOB_DESCRIPTION',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    provider: 'MOCK',
    model: 'mock-model',
    status: 'SUCCEEDED',
    inputFingerprint: 'fingerprint',
    inputCharacterCount: 100,
    outputCharacterCount: 100,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCost: 0,
    latencyMs: 10,
    createdAt: now(),
    completedAt: now(),
  });
  const fingerprint = buildJobDescriptionSourceFingerprint(state.jobs[0], state.requisitions[0]);
  state.intelligenceResults.push({
    id: 'result-1',
    organisationId: 'org-1',
    executionId: 'exec-1',
    entityType: 'JobDescription',
    entityId: 'job-1',
    sourceFingerprint: fingerprint,
    resultVersion: 'job-description-v2',
    promptVersion: '1.0.0',
    normalizedOutput: {
      jobId: 'job-1',
      kind: 'FULL_DESCRIPTION',
      openingSummary: 'Cached job description summary.',
      roleOverview: 'This cached Backend Engineer role supports payments services. The engineer will maintain reliable delivery for product teams.',
      keyResponsibilities: [],
      requiredQualifications: ['Java'],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
    createdAt: now(),
    dismissedAt: null,
    supersededAt: null,
  });
  state.jobDescriptionStates.push({
    id: 'state-1',
    organisationId: 'org-1',
    jobId: 'job-1',
    kind: 'FULL_DESCRIPTION',
    status: 'READY',
    latestExecutionId: 'exec-1',
    latestResultId: 'result-1',
    sourceFingerprint: fingerprint,
    sourceVersion: 'job-description-source-v1',
    schemaVersion: '1.0.0',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    resultVersion: 'job-description-v2',
    provider: 'MOCK',
    providerVersion: 'provider:mock-v1',
    model: 'mock-model',
    modelVersion: 'mock-model',
    latencyMs: 10,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    generatedAt: now(),
    staleReason: null,
    metadata: { version: '1.0.0' },
    createdAt: now(),
    updatedAt: now(),
  });

  const response = await getJobDescription(adminActor(), { jobId: 'job-1' });

  assert.equal(response.execution.cacheHit, true);
  assert.equal(response.openingSummary, 'Cached job description summary.');
  assert.equal(state.backgroundTasks.length, 0);
});

test('meaningful job changes mark state stale and queue regeneration', async () => {
  const fingerprint = buildJobDescriptionSourceFingerprint(state.jobs[0], state.requisitions[0]);
  state.jobDescriptionStates.push({
    id: 'state-1',
    organisationId: 'org-1',
    jobId: 'job-1',
    kind: 'FULL_DESCRIPTION',
    status: 'READY',
    latestExecutionId: 'exec-1',
    latestResultId: 'result-1',
    sourceFingerprint: fingerprint,
    sourceVersion: 'job-description-source-v1',
    schemaVersion: '1.0.0',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    resultVersion: 'job-description-v2',
    provider: 'MOCK',
    providerVersion: 'provider:mock-v1',
    model: 'mock-model',
    modelVersion: 'mock-model',
    generatedAt: now(),
    staleReason: null,
    metadata: {},
    createdAt: now(),
    updatedAt: now(),
  });
  state.intelligenceExecutions.push({
    id: 'exec-1',
    organisationId: 'org-1',
    feature: 'JOB_DESCRIPTION',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    provider: 'MOCK',
    model: 'mock-model',
    status: 'SUCCEEDED',
    inputFingerprint: 'fingerprint',
    inputCharacterCount: 100,
    outputCharacterCount: 100,
    createdAt: now(),
    completedAt: now(),
  });
  state.intelligenceResults.push({
    id: 'result-1',
    organisationId: 'org-1',
    executionId: 'exec-1',
    entityType: 'JobDescription',
    entityId: 'job-1',
    sourceFingerprint: fingerprint,
    resultVersion: 'job-description-v2',
    promptVersion: '1.0.0',
    normalizedOutput: {
      jobId: 'job-1',
      kind: 'FULL_DESCRIPTION',
      summary: 'Existing summary.',
      responsibilities: [],
      requiredQualifications: [],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
    createdAt: now(),
    dismissedAt: null,
    supersededAt: null,
  });

  state.jobs[0].description = 'Updated description with Java, Spring Boot, AWS, and Kafka.';

  const response = await getJobDescription(adminActor(), { jobId: 'job-1' });

  assert.equal(response.execution.status, 'STALE');
  assert.equal(state.jobDescriptionStates[0].status, 'STALE');
  assert.equal(state.backgroundTasks[0].type, 'JOB_DESCRIPTION_GENERATION');
});

test('regeneration queues a job description generation task and status endpoint reflects pending state', async () => {
  const response = await regenerateJobDescription(adminActor(), { jobId: 'job-1', forceRegenerate: true });
  const status = await getJobDescriptionStatus(adminActor(), { jobId: 'job-1' });

  assert.equal(response.queued, true);
  assert.equal(response.status, 'PENDING');
  assert.equal(state.backgroundTasks[0].type, 'JOB_DESCRIPTION_GENERATION');
  assert.equal(status.status, 'PENDING');
});

test('worker generation stores a ready result with the mock provider', async () => {
  const task = generationTask();

  const result = await runJobDescriptionGenerationTask(task);

  assert.equal(result, 'success');
  assert.equal(state.intelligenceResults.length, 1);
  assert.equal(state.intelligenceExecutions.length, 1);
  assert.equal(state.intelligenceExecutions[0].status, 'SUCCEEDED');
  assert.equal(state.jobDescriptionStates[0].status, 'READY');
  assert.equal(state.jobDescriptionStates[0].latestResultId, state.intelligenceResults[0].id);
  assert.equal(state.intelligenceResults[0].normalizedOutput.requiredQualifications.includes('Java'), true);
});

test('stored generation result can become an editable draft through the source result handoff', async () => {
  await runJobDescriptionGenerationTask(generationTask('task-draft-handoff'));
  const stored = state.intelligenceResults[0];

  const draft = await createJobDescriptionDraft(recruiterActor(), {
    jobId: 'job-1',
    sourceResultId: stored.id,
    content: stored.normalizedOutput,
    approve: false,
  });
  const drafts = await listJobDescriptionDrafts(recruiterActor(), { jobId: 'job-1' });

  assert.equal(draft.sourceResultId, stored.id);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].sourceResultId, stored.id);
  assert.equal(drafts[0].content.openingSummary, stored.normalizedOutput.openingSummary);
  assert.equal(drafts[0].content.roleOverview, stored.normalizedOutput.roleOverview);
  assert.notEqual(drafts[0].content.openingSummary, drafts[0].content.roleOverview);
  assert.equal(state.jobs[0].status, 'DRAFT');
});

test('authoritative structured skills override model-added, omitted, or replaced skills', () => {
  state.jobs[0].skillsRequired = ['Anaplan model building', 'Finance planning'];
  state.jobs[0].skillsPreferred = ['Connected planning'];
  state.jobs[0].title = 'Anaplan Developer';
  state.jobs[0].description = 'Build Anaplan planning models for finance forecasting.';

  const added = applyAuthoritativeJobFacts(validAiJobDescription({
    openingSummary: 'Build Anaplan planning models for finance teams.',
    roleOverview: 'This Anaplan Developer role builds Anaplan planning models for finance forecasting. The developer will support finance teams with maintainable planning workflows.',
    responsibilities: [
      'Build Anaplan planning workflows for finance teams.',
      'Support forecasting model updates with business stakeholders.',
      'Maintain planning models using recruiter-confirmed Anaplan practices.',
    ],
    requiredQualifications: ['Anaplan model building', 'Finance planning', 'SQL'],
    preferredQualifications: ['Connected planning', 'AWS Certified Developer'],
  }), state.jobs[0], state.requisitions[0]);

  assert.deepEqual(added.requiredQualifications, ['Anaplan model building', 'Finance planning']);
  assert.deepEqual(added.preferredQualifications, ['Connected planning']);
  assert.equal(added.assumptions.some((item) => /AI suggested additional required skills/i.test(item)), true);
  assert.equal(added.assumptions.some((item) => /AI suggested additional preferred skills/i.test(item)), true);

  const omitted = applyAuthoritativeJobFacts(validAiJobDescription({
    openingSummary: 'Build Anaplan planning models for finance teams.',
    roleOverview: 'This Anaplan Developer role builds Anaplan planning models for finance forecasting. The developer will support finance teams with maintainable planning workflows.',
    responsibilities: [
      'Build Anaplan planning workflows for finance teams.',
      'Support forecasting model updates with business stakeholders.',
      'Maintain planning models using recruiter-confirmed Anaplan practices.',
    ],
    requiredQualifications: ['Anaplan model building'],
    preferredQualifications: [],
  }), state.jobs[0], state.requisitions[0]);
  assert.deepEqual(omitted.requiredQualifications, ['Anaplan model building', 'Finance planning']);

  const replaced = applyAuthoritativeJobFacts(validAiJobDescription({
    openingSummary: 'Build Anaplan planning models for finance teams.',
    roleOverview: 'This Anaplan Developer role builds Anaplan planning models for finance forecasting. The developer will support finance teams with maintainable planning workflows.',
    responsibilities: [
      'Build Anaplan planning workflows for finance teams.',
      'Support forecasting model updates with business stakeholders.',
      'Maintain planning models using recruiter-confirmed Anaplan practices.',
    ],
    requiredQualifications: ['SQL', 'Tableau'],
  }), state.jobs[0], state.requisitions[0]);
  assert.deepEqual(replaced.requiredQualifications, ['Anaplan model building', 'Finance planning']);
});

test('authoritative fact validation accepts case, spacing, and approved aliases', () => {
  state.jobs[0].skillsRequired = ['SpringBoot', 'AWS Cloud'];
  const output = applyAuthoritativeJobFacts(validAiJobDescription({
    roleOverview: 'This Senior Backend Engineer role builds Spring Boot services on AWS. The engineer will support backend services for product teams.',
    responsibilities: [
      'Build Spring Boot services for backend workflows.',
      'Operate AWS-backed services with product partners.',
      'Maintain Java services using recruiter-confirmed practices.',
    ],
    requiredQualifications: ['spring boot', 'Amazon Web Services'],
  }), state.jobs[0], state.requisitions[0]);

  assert.deepEqual(output.requiredQualifications, ['SpringBoot', 'AWS Cloud']);
});

test('authoritative fact validation blocks invented certification, degree, and experience requirements', () => {
  state.jobs[0].skillsRequired = ['Anaplan model building', 'Finance planning'];
  state.jobs[0].experienceMin = 2;
  state.jobs[0].experienceMax = 5;
  state.jobs[0].title = 'Anaplan Developer';
  state.jobs[0].description = 'Build Anaplan planning models for finance forecasting.';

  assert.throws(
    () => applyAuthoritativeJobFacts(validAiJobDescription({
      openingSummary: 'Build Anaplan planning models for finance teams.',
      roleOverview: 'This Anaplan Developer role requires PMP certification and an MBA. The developer must bring 8+ years of Anaplan delivery experience.',
      responsibilities: [
        'Build Anaplan planning workflows for finance teams.',
        'Support forecasting model updates with business stakeholders.',
        'Maintain planning models using recruiter-confirmed Anaplan practices.',
      ],
      requiredQualifications: ['Anaplan model building', 'Finance planning'],
    }), state.jobs[0], state.requisitions[0]),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID'
      && error.diagnostics.some((item) => item.reason === 'unsupported_named_fact' && item.term === 'PMP')
      && error.diagnostics.some((item) => item.reason === 'unsupported_named_fact' && item.term === 'MBA')
      && error.diagnostics.some((item) => item.reason === 'unsupported_experience_requirement'),
  );
});

test('provider-added skills are not persisted or published; preview and published job use source facts', async () => {
  state.jobs[0].skillsRequired = ['Anaplan model building', 'Finance planning'];
  state.jobs[0].skillsPreferred = [];
  state.jobs[0].title = 'Anaplan Developer';
  state.jobs[0].description = 'Build Anaplan planning models for finance forecasting.';
  installOpenAiMockResponse(validAiJobDescription({
    openingSummary: 'Build Anaplan planning models for finance teams.',
    roleOverview: 'This Anaplan Developer role builds Anaplan planning models for finance forecasting. The developer will support finance teams with maintainable planning workflows.',
    responsibilities: [
      'Build Anaplan planning workflows for finance teams.',
      'Support forecasting model updates with business stakeholders.',
      'Maintain planning models using recruiter-confirmed Anaplan practices.',
    ],
    requiredQualifications: ['Anaplan model building', 'Finance planning', 'SQL'],
    preferredQualifications: ['Tableau'],
  }));

  await runJobDescriptionGenerationTask(generationTask('task-skill-addition'));
  const stored = state.intelligenceResults[0].normalizedOutput;
  assert.deepEqual(stored.requiredQualifications, ['Anaplan model building', 'Finance planning']);
  assert.deepEqual(stored.preferredQualifications, []);

  const draft = await createJobDescriptionDraft(recruiterActor(), {
    jobId: 'job-1',
    sourceResultId: state.intelligenceResults[0].id,
    content: stored,
    approve: true,
  });
  assert.deepEqual(draft.jobSnapshot.skillsRequired, ['Anaplan model building', 'Finance planning']);

  const applied = await applyJobDescriptionDraft(recruiterActor(), {
    draftId: draft.id,
    applyTitle: false,
    publishStatus: 'DRAFT',
  });
  assert.equal(applied.applied, true);
  assert.deepEqual(state.jobs[0].skillsRequired, ['Anaplan model building', 'Finance planning']);
  assert.deepEqual(serializePublicJob(state.jobs[0]).skillsRequired, ['Anaplan model building', 'Finance planning']);
  assert.equal(JSON.stringify(serializePublicJob(state.jobs[0])).includes('Tableau'), false);
});

test('invalid AI job description output preserves recruiter edits and does not publish', async () => {
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-4o';
  env.intelligenceBaseUrl = 'https://api.openai.test/v1';
  env.intelligenceApiKey = 'test-key';
  env.intelligenceMaxRetries = 0;
  resetIntelligenceProvider();

  state.jobs[0].status = 'DRAFT';
  state.jobDescriptionDrafts.push({
    id: 'draft-edited-1',
    organisationId: 'org-1',
    jobId: 'job-1',
    versionGroupId: 'draft-edited-1',
    version: 1,
    previousVersionId: null,
    status: 'DRAFT',
    isLatestVersion: true,
    title: 'Edited backend draft',
    content: {
      title: 'Edited backend draft',
      openingSummary: 'Recruiter edited summary must remain intact.',
      keyResponsibilities: ['Recruiter edited responsibility'],
      requiredQualifications: ['Java'],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
    jobSnapshot: null,
    sourceStateId: null,
    sourceExecutionId: null,
    sourceResultId: null,
    templateId: null,
    templateVersionId: null,
    approvedAt: null,
    approvedByUserId: null,
    appliedAt: null,
    appliedByUserId: null,
    createdByUserId: 'recruiter-1',
    updatedByUserId: 'recruiter-1',
    createdAt: now(),
    updatedAt: now(),
  });

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      model: 'gpt-4o',
      choices: [{
        message: {
          content: JSON.stringify({
            openingSummary: 'Backend role.',
            roleOverview: 'This Backend Engineer role owns backend services for product teams. The engineer will ship APIs and support production reliability.',
            responsibilities: ['Own services', 'Ship features', 'Support operations'],
            requiredQualifications: ['Java', 'Any', 'AWS'],
            preferredQualifications: [],
            screeningQuestions: [],
            assumptions: [],
            exclusionaryWordingWarnings: [],
            missingFields: [],
            interviewFocus: [],
            title: 'Unexpected title',
          }),
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    }),
  });

  const task = {
    id: 'task-invalid',
    organisationId: 'org-1',
    entityType: 'Job',
    entityId: 'job-1',
    payload: { jobId: 'job-1', requestedByUserId: 'recruiter-1' },
    createdByUserId: 'recruiter-1',
    attemptCount: 1,
  };

  await assert.rejects(
    () => runJobDescriptionGenerationTask(task),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID',
  );

  assert.equal(state.intelligenceResults.length, 0);
  assert.equal(state.jobDescriptionStates[0].status, 'FAILED');
  assert.equal(state.jobDescriptionStates[0].latestResultId || null, null);
  assert.equal(state.jobDescriptionStates[0].metadata.validationDiagnostics.some((item) => item.path === 'title'), true);
  assert.equal(state.jobDescriptionDrafts[0].content.openingSummary, 'Recruiter edited summary must remain intact.');
  assert.equal(state.jobs[0].status, 'DRAFT');
});

test('feature flag disabled falls back to deterministic output without queueing AI generation', async () => {
  state.featureFlags[0].enabled = false;

  const response = await getJobDescription(recruiterActor(), { jobId: 'job-1' });

  assert.equal(response.execution.status, 'DISABLED');
  assert.equal(state.backgroundTasks.length, 0);
  assert.equal(response.openingSummary, 'Build reliable backend services with Java, Spring Boot, and AWS.');
});

test('users without job intelligence permission are denied', async () => {
  await assert.rejects(
    () => getJobDescription(viewerActor(), { jobId: 'job-1' }),
    (error) => error.statusCode === 403,
  );
});

test('legacy job intelligence compatibility path remains functional', async () => {
  const response = await getJobIntelligence(adminActor(), {
    jobId: 'job-1',
    mode: 'DRAFT_DESCRIPTION',
    sourceDescription: state.jobs[0].description,
    forceRegenerate: true,
  });

  assert.equal(typeof response.generatedLabel, 'string');
  assert.equal(response.mode, 'DRAFT_DESCRIPTION');
  assert.ok(response.assisted || response.deterministic);
  assert.equal(Array.isArray((response.assisted || response.deterministic).requiredQualifications), true);
});

test('draft workflow supports create, list, get, versioned update, and apply', async () => {
  const created = await createJobDescriptionDraft(recruiterActor(), {
    jobId: 'job-1',
    title: 'Backend Draft v1',
    content: {
      title: 'Senior Backend Engineer',
      summary: 'Draft summary for backend role.',
      openingSummary: 'Opening summary for backend candidates.',
      roleOverview: 'This Backend Engineer role supports product APIs and platform reliability. The engineer will partner with product teams on delivery.',
      keyResponsibilities: ['Own backend systems'],
      requiredQualifications: ['Java', 'AWS'],
      preferredQualifications: ['Kafka'],
      screeningQuestions: [],
      assumptions: ['Internal assumption must stay out of the public job.'],
      exclusionaryWordingWarnings: [],
      missingFields: ['Internal missing-field note must stay out of the public job.'],
      interviewFocus: ['Validate AWS depth'],
    },
    approve: false,
  });

  const listed = await listJobDescriptionDrafts(recruiterActor(), { jobId: 'job-1' });
  const fetched = await getJobDescriptionDraft(recruiterActor(), { draftId: created.id });
  const updated = await updateJobDescriptionDraft(recruiterActor(), {
    draftId: created.id,
    content: {
      summary: 'Approved summary for backend role.',
      requiredQualifications: ['Java', 'AWS', 'Kafka'],
    },
    approve: true,
  });
  const applied = await applyJobDescriptionDraft(recruiterActor(), {
    draftId: updated.id,
    applyTitle: true,
    publishStatus: 'DRAFT',
  });

  assert.equal(created.version, 1);
  assert.equal(listed.length, 1);
  assert.equal(fetched.id, created.id);
  assert.equal(updated.version, 2);
  assert.equal(updated.status, 'APPROVED');
  assert.equal(state.jobDescriptionDrafts.find((item) => item.id === created.id).isLatestVersion, false);
  assert.equal(applied.applied, true);
  assert.equal(applied.draft.status, 'APPLIED');
  assert.equal(state.jobs[0].description, [
    'Opening summary for backend candidates.',
    'This Backend Engineer role supports product APIs and platform reliability. The engineer will partner with product teams on delivery.',
  ].join('\n\n'));
  assert.equal(state.jobs[0].requirements.some((item) => item.includes('Internal assumption')), false);
  assert.equal(state.jobs[0].requirements.some((item) => item.includes('Internal missing-field')), false);
  assert.equal(state.jobs[0].description.includes('Validate AWS depth'), false);
  assert.deepEqual(state.jobs[0].skillsRequired, ['Java', 'AWS', 'Kafka']);
});

test('draft apply rejects unapproved drafts and viewer access is denied', async () => {
  const created = await createJobDescriptionDraft(recruiterActor(), {
    jobId: 'job-1',
    content: {
      summary: 'Unapproved draft.',
      responsibilities: [],
      requiredQualifications: ['Java'],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
  });

  await assert.rejects(
    () => applyJobDescriptionDraft(recruiterActor(), { draftId: created.id }),
    (error) => error.statusCode === 409,
  );
  await assert.rejects(
    () => listJobDescriptionDrafts(viewerActor(), { jobId: 'job-1' }),
    (error) => error.statusCode === 403,
  );
});

test('template workflow supports create, versioning, activation, and system visibility', async () => {
  const templatesBefore = await listJobDescriptionTemplates(recruiterActor());
  const created = await createJobDescriptionTemplate(recruiterActor(), {
    key: 'java-backend-template',
    name: 'Java Backend Template',
    description: 'Recruiter-owned template',
    content: {
      summary: 'Template summary.',
      responsibilities: ['Build services'],
      requiredQualifications: ['Java'],
      preferredQualifications: ['Kafka'],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
  });
  const version = await createJobDescriptionTemplateVersion(recruiterActor(), {
    templateId: created.id,
    title: 'Version 2',
    content: {
      summary: 'Template summary v2.',
      responsibilities: ['Build services', 'Improve reliability'],
      requiredQualifications: ['Java', 'AWS'],
      preferredQualifications: ['Kafka'],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: ['Validate AWS'],
    },
    activate: true,
  });
  const activated = await activateJobDescriptionTemplate(recruiterActor(), {
    templateId: created.id,
    versionId: version.id,
    active: false,
  });
  const fetched = await getJobDescriptionTemplate(recruiterActor(), { templateId: created.id });

  assert.equal(templatesBefore.some((item) => item.scope === 'SYSTEM'), true);
  assert.equal(created.versions.length, 1);
  assert.equal(version.version, 2);
  assert.equal(activated.isActive, false);
  assert.ok(activated.archivedAt);
  assert.equal(fetched.versions.length, 2);
});

test('job history returns draft versions and generation records', async () => {
  const fingerprint = buildJobDescriptionSourceFingerprint(state.jobs[0], state.requisitions[0]);
  state.intelligenceExecutions.push({
    id: 'exec-h1',
    organisationId: 'org-1',
    feature: 'JOB_DESCRIPTION',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    provider: 'MOCK',
    model: 'mock-model',
    status: 'SUCCEEDED',
    inputFingerprint: 'fingerprint-h1',
    inputCharacterCount: 100,
    outputCharacterCount: 100,
    createdAt: now(),
    completedAt: now(),
  });
  state.intelligenceResults.push({
    id: 'result-h1',
    organisationId: 'org-1',
    executionId: 'exec-h1',
    entityType: 'JobDescription',
    entityId: 'job-1',
    sourceFingerprint: fingerprint,
    resultVersion: 'job-description-v2',
    promptVersion: '1.0.0',
    normalizedOutput: {
      jobId: 'job-1',
      kind: 'FULL_DESCRIPTION',
      summary: 'History result',
      responsibilities: [],
      requiredQualifications: ['Java'],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
    createdAt: now(),
    dismissedAt: null,
    supersededAt: null,
  });
  state.jobDescriptionStates.push({
    id: 'state-h1',
    organisationId: 'org-1',
    jobId: 'job-1',
    kind: 'FULL_DESCRIPTION',
    status: 'READY',
    latestExecutionId: 'exec-h1',
    latestResultId: 'result-h1',
    sourceFingerprint: fingerprint,
    sourceVersion: 'job-description-source-v1',
    schemaVersion: '1.0.0',
    promptKey: 'JOB_DESCRIPTION_FULL',
    promptVersion: '1.0.0',
    resultVersion: 'job-description-v2',
    provider: 'MOCK',
    providerVersion: 'provider:mock-v1',
    model: 'mock-model',
    modelVersion: 'mock-model',
    generatedAt: now(),
    staleReason: null,
    metadata: {},
    createdAt: now(),
    updatedAt: now(),
  });
  await createJobDescriptionDraft(recruiterActor(), {
    jobId: 'job-1',
    content: {
      summary: 'History draft',
      responsibilities: [],
      requiredQualifications: ['Java'],
      preferredQualifications: [],
      screeningQuestions: [],
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: [],
    },
  });

  const history = await getJobDescriptionHistory(recruiterActor(), { jobId: 'job-1' });

  assert.equal(history.jobId, 'job-1');
  assert.equal(history.state.status, 'READY');
  assert.equal(history.drafts.length, 1);
  assert.equal(history.generations.length, 1);
  assert.equal(history.generations[0].resultId, 'result-h1');
});
