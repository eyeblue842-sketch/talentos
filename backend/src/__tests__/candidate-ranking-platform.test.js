import test, { before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let env;
let resetIntelligenceProvider;
let getCandidateJobMatch;
let runCandidateJobMatchGenerationTask;
let createMatchScoringProfile;
let createMatchScoringProfileVersion;
let activateMatchScoringProfile;
let getMatchScoringProfile;
let createRecruiterMatchOverride;
let listRecruiterMatchOverrides;
let generateCandidateRanking;
let getCandidateRanking;
let getCandidateRankingStatus;
let runJobCandidateRankingGenerationTask;

let state;
let idCounter = 1;
let originalEnv = {};

function now() {
  return new Date('2026-07-28T12:00:00.000Z');
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
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

function seedState() {
  idCounter = 1;
  state = {
    organisations: [
      { id: 'org-1', name: 'Acme', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    users: [
      { id: 'admin-1', role: 'ADMIN', email: 'admin@careeriz.com', isActive: true, sessionVersion: 0 },
      { id: 'recruiter-1', role: 'RECRUITER', email: 'recruiter@careeriz.com', isActive: true, sessionVersion: 0 },
    ],
    memberships: [
      { id: 'membership-1', organisationId: 'org-1', userId: 'recruiter-1', role: 'ADMIN', status: 'ACTIVE', createdAt: now(), updatedAt: now() },
    ],
    featureFlags: [
      { id: 'flag-1', organisationId: 'org-1', key: 'intelligence.candidate_matching', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-2', organisationId: 'org-1', key: 'intelligence.candidate_ranking', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-3', organisationId: 'org-1', key: 'intelligence.match_overrides', enabled: true, createdAt: now(), updatedAt: now() },
      { id: 'flag-4', organisationId: 'org-1', key: 'intelligence.match_scoring_profiles', enabled: true, createdAt: now(), updatedAt: now() },
    ],
    candidates: [
      {
        id: 'candidate-1',
        organisationId: 'org-1',
        fullName: 'Candidate One',
        email: 'one@example.com',
        phoneNumber: '9999999999',
        linkedInUrlNormalized: 'linkedin.com/in/one',
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
        skills: ['Java', 'Spring Boot', 'AWS', 'Docker'],
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
      {
        id: 'candidate-2',
        organisationId: 'org-1',
        fullName: 'Candidate Two',
        email: 'two@example.com',
        phoneNumber: '8888888888',
        linkedInUrlNormalized: 'linkedin.com/in/two',
        headline: 'Backend Developer',
        currentTitle: 'Backend Developer',
        currentEmployer: 'Beta Labs',
        location: 'Chennai',
        totalExperience: 4,
        expectedCtcLpa: 30,
        noticePeriodDays: 90,
        salaryVisibleToRecruiters: true,
        workplacePreferences: ['REMOTE'],
        employmentPreferences: ['FULL_TIME'],
        skills: ['Java'],
        functionalSkills: [],
        tools: [],
        frameworks: [],
        cloudPlatforms: [],
        databases: [],
        educationEntries: [],
        searchableProfile: true,
        latestResumeAssetId: 'resume-2',
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
        updatedAt: now(),
        createdAt: now(),
      },
    ],
    applications: [
      { id: 'app-1', organisationId: 'org-1', jobId: 'job-1', candidateId: 'candidate-1', currentStage: 'APPLIED', appliedAt: now(), updatedAt: now() },
      { id: 'app-2', organisationId: 'org-1', jobId: 'job-1', candidateId: 'candidate-2', currentStage: 'APPLIED', appliedAt: now(), updatedAt: now() },
    ],
    resumeAssets: [
      { id: 'resume-1', candidateId: 'candidate-1', ownerUserId: 'recruiter-1', originalFilename: 'one.pdf', storageKey: 'resumes/one.pdf', storageProvider: 'local', mimeType: 'application/pdf', sizeBytes: 1234, parsingStatus: 'PARTIAL', parsedText: 'Candidate One', parsedData: { parser: 'mock-parser-v1' }, externalResumeVersion: null, updatedAt: now(), createdAt: now() },
      { id: 'resume-2', candidateId: 'candidate-2', ownerUserId: 'recruiter-1', originalFilename: 'two.pdf', storageKey: 'resumes/two.pdf', storageProvider: 'local', mimeType: 'application/pdf', sizeBytes: 1234, parsingStatus: 'PARTIAL', parsedText: 'Candidate Two', parsedData: { parser: 'mock-parser-v1' }, externalResumeVersion: null, updatedAt: now(), createdAt: now() },
    ],
    candidateIntelligenceStates: [
      { id: 'cis-1', organisationId: 'org-1', candidateId: 'candidate-1', kind: 'PROFILE_OVERVIEW', status: 'READY', latestExecutionId: 'ci-exec-1', latestResultId: 'ci-result-1', sourceFingerprint: 'candidate-intel-1', resultVersion: 'candidate-intelligence-v1' },
      { id: 'cis-2', organisationId: 'org-1', candidateId: 'candidate-2', kind: 'PROFILE_OVERVIEW', status: 'READY', latestExecutionId: 'ci-exec-2', latestResultId: 'ci-result-2', sourceFingerprint: 'candidate-intel-2', resultVersion: 'candidate-intelligence-v1' },
    ],
    jobDescriptionStates: [
      { id: 'jds-1', organisationId: 'org-1', jobId: 'job-1', kind: 'FULL_DESCRIPTION', status: 'READY', latestExecutionId: 'jd-exec-1', latestResultId: 'jd-result-1', sourceFingerprint: 'job-desc-1', resultVersion: 'job-description-v2' },
    ],
    candidateJobMatchStates: [],
    intelligenceExecutions: [],
    intelligenceResults: [],
    backgroundTasks: [],
    auditLogs: [],
    matchScoringProfiles: [],
    matchScoringProfileVersions: [],
    recruiterMatchOverrides: [],
    candidateRankingSnapshots: [],
    candidateRankingEntries: [],
  };
}

function withCandidateRelations(candidate, include = {}) {
  if (!candidate) return null;
  return {
    ...clone(candidate),
    latestResumeAsset: include.latestResumeAsset ? clone(state.resumeAssets.find((item) => item.id === candidate.latestResumeAssetId) || null) : clone(state.resumeAssets.find((item) => item.id === candidate.latestResumeAssetId) || null),
  };
}

function withJob(job) {
  return job ? { ...clone(job), requisition: null } : null;
}

function installPrismaMocks() {
  prisma.organisation ||= {};
  prisma.organisationMembership ||= {};
  prisma.featureFlag ||= {};
  prisma.candidateProfile ||= {};
  prisma.job ||= {};
  prisma.application ||= {};
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
  prisma.recruiterMatchOverride ||= {};
  prisma.candidateRankingSnapshot ||= {};
  prisma.candidateRankingEntry ||= {};

  prisma.organisation.findFirst = async ({ where = {} } = {}) => clone(state.organisations.find((item) => (!where.id || item.id === where.id) && (!where.status || item.status === where.status)) || null);
  prisma.organisationMembership.findMany = async ({ where = {}, include = {} } = {}) => state.memberships
    .filter((item) => item.userId === where.userId && item.status === where.status)
    .map((item) => ({ ...clone(item), organisation: include.organisation ? clone(state.organisations.find((org) => org.id === item.organisationId) || null) : undefined, customRoleDefinition: null }));
  prisma.featureFlag.findMany = async ({ where = {} } = {}) => state.featureFlags.filter((item) => item.organisationId === where.organisationId && (!where.key?.in || where.key.in.includes(item.key))).map(clone);
  prisma.featureFlag.createMany = async ({ data = [] } = {}) => {
    for (const item of data) state.featureFlags.push({ id: nextId('flag'), createdAt: now(), updatedAt: now(), ...clone(item) });
    return { count: data.length };
  };
  prisma.featureFlag.findUnique = async ({ where } = {}) => clone(state.featureFlags.find((item) => item.organisationId === where.organisationId_key.organisationId && item.key === where.organisationId_key.key) || null);

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
    return withCandidateRelations(found, {});
  };

  prisma.job.findFirst = async ({ where = {} } = {}) => withJob(state.jobs.find((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId)) || null);

  prisma.application.findMany = async ({ where = {}, include = {}, orderBy = [], take } = {}) => {
    let rows = state.applications.filter((item) => (!where.organisationId || item.organisationId === where.organisationId) && (!where.jobId || item.jobId === where.jobId));
    if (orderBy[0]?.updatedAt === 'desc') rows = rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (take) rows = rows.slice(0, take);
    return rows.map((row) => ({ ...clone(row), candidate: include.candidate ? clone(state.candidates.find((candidate) => candidate.id === row.candidateId) || null) : undefined }));
  };

  prisma.candidateIntelligenceState.findUnique = async ({ where = {} } = {}) => clone(state.candidateIntelligenceStates.find((item) => item.organisationId === where.organisationId_candidateId_kind.organisationId && item.candidateId === where.organisationId_candidateId_kind.candidateId && item.kind === where.organisationId_candidateId_kind.kind) || null);
  prisma.jobDescriptionState.findUnique = async ({ where = {} } = {}) => clone(state.jobDescriptionStates.find((item) => item.organisationId === where.organisationId_jobId_kind.organisationId && item.jobId === where.organisationId_jobId_kind.jobId && item.kind === where.organisationId_jobId_kind.kind) || null);

  prisma.candidateJobMatchState.findUnique = async ({ where = {}, include = {} } = {}) => {
    const found = state.candidateJobMatchStates.find((item) => item.organisationId === where.organisationId_candidateId_jobId.organisationId && item.candidateId === where.organisationId_candidateId_jobId.candidateId && item.jobId === where.organisationId_candidateId_jobId.jobId) || null;
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
    const existing = state.candidateJobMatchStates.find((item) => item.organisationId === where.organisationId_candidateId_jobId.organisationId && item.candidateId === where.organisationId_candidateId_jobId.candidateId && item.jobId === where.organisationId_candidateId_jobId.jobId);
    const record = existing ? applyData(existing, clone(update)) : (() => {
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
    const row = { id: nextId('exec'), createdAt: now(), completedAt: null, promptTokens: null, completionTokens: null, estimatedCost: null, latencyMs: null, ...clone(data) };
    state.intelligenceExecutions.push(row);
    return clone(row);
  };
  prisma.intelligenceExecution.update = async ({ where, data }) => {
    const row = state.intelligenceExecutions.find((item) => item.id === where.id);
    applyData(row, clone(data));
    return clone(row);
  };
  prisma.intelligenceExecution.count = async () => state.intelligenceExecutions.length;

  prisma.intelligenceResult.findFirst = async ({ where = {}, include = {}, orderBy } = {}) => {
    let rows = state.intelligenceResults.filter((item) => (!where.organisationId || item.organisationId === where.organisationId) && (!where.entityType || item.entityType === where.entityType) && (!where.entityId || item.entityId === where.entityId) && (!where.sourceFingerprint || item.sourceFingerprint === where.sourceFingerprint) && (!where.resultVersion || item.resultVersion === where.resultVersion) && (!where.promptVersion || item.promptVersion === where.promptVersion) && (where.dismissedAt !== null || item.dismissedAt == null) && (where.supersededAt !== null || item.supersededAt == null));
    if (orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const found = rows[0] || null;
    if (!found) return null;
    return { ...clone(found), execution: include.execution ? clone(state.intelligenceExecutions.find((item) => item.id === found.executionId) || null) : undefined };
  };
  prisma.intelligenceResult.create = async ({ data }) => {
    const row = { id: nextId('result'), createdAt: now(), supersededAt: null, dismissedAt: null, expiresAt: null, ...clone(data) };
    state.intelligenceResults.push(row);
    return clone(row);
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

  prisma.backgroundTask.findFirst = async ({ where = {} } = {}) => clone(state.backgroundTasks.find((item) => (!where.type || item.type === where.type) && (!where.entityType || item.entityType === where.entityType) && (!where.entityId || item.entityId === where.entityId) && (!where.status?.in || where.status.in.includes(item.status))) || null);
  prisma.backgroundTask.create = async ({ data }) => {
    const existing = state.backgroundTasks.find((item) => item.idempotencyKey === data.idempotencyKey);
    if (existing) {
      const error = new Error('Unique constraint failed.');
      error.code = 'P2002';
      throw error;
    }
    const row = { id: nextId('task'), createdAt: now(), updatedAt: now(), completedAt: null, lastAttemptAt: null, nextAttemptAt: null, ...clone(data) };
    state.backgroundTasks.push(row);
    return clone(row);
  };
  prisma.backgroundTask.findUnique = async ({ where = {} } = {}) => clone(state.backgroundTasks.find((item) => item.id === where.id || item.idempotencyKey === where.idempotencyKey) || null);

  prisma.auditLog.create = async ({ data }) => {
    const row = { id: nextId('audit'), createdAt: now(), ...clone(data) };
    state.auditLogs.push(row);
    return clone(row);
  };

  prisma.user.findUnique = async ({ where = {}, include = {} } = {}) => {
    const row = state.users.find((item) => item.id === where.id) || null;
    return row ? { ...clone(row), recruiterProfile: include.recruiterProfile ? null : undefined, candidateProfile: include.candidateProfile ? null : undefined } : null;
  };

  prisma.matchScoringProfile.findFirst = async ({ where = {}, include = {} } = {}) => {
    const row = state.matchScoringProfiles.find((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId) && (!where.key || item.key === where.key) && (where.isActive === undefined || item.isActive === where.isActive) && (where.archivedAt === undefined || item.archivedAt === where.archivedAt) && (!where.activeVersionId || (where.activeVersionId.not ? item.activeVersionId != null : item.activeVersionId === where.activeVersionId))) || null;
    if (!row) return null;
    return {
      ...clone(row),
      activeVersion: include.activeVersion ? clone(state.matchScoringProfileVersions.find((item) => item.id === row.activeVersionId) || null) : undefined,
      versions: include.versions ? state.matchScoringProfileVersions.filter((item) => item.profileId === row.id).sort((a, b) => b.version - a.version).slice(0, include.versions.take || 100).map(clone) : undefined,
    };
  };
  prisma.matchScoringProfile.findMany = async ({ where = {}, include = {}, orderBy = [] } = {}) => {
    let rows = state.matchScoringProfiles.filter((item) => !where.organisationId || item.organisationId === where.organisationId);
    if (orderBy[0]?.isActive === 'desc') rows = rows.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.key.localeCompare(b.key));
    return rows.map((row) => ({
      ...clone(row),
      versions: include.versions ? state.matchScoringProfileVersions.filter((item) => item.profileId === row.id).sort((a, b) => b.version - a.version).map(clone) : undefined,
    }));
  };
  prisma.matchScoringProfile.create = async ({ data }) => {
    const row = { id: nextId('profile'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.matchScoringProfiles.push(row);
    return clone(row);
  };
  prisma.matchScoringProfile.update = async ({ where, data, include = {} }) => {
    const row = state.matchScoringProfiles.find((item) => item.id === where.id);
    applyData(row, clone(data));
    return {
      ...clone(row),
      versions: include.versions ? state.matchScoringProfileVersions.filter((item) => item.profileId === row.id).sort((a, b) => b.version - a.version).map(clone) : undefined,
    };
  };
  prisma.matchScoringProfile.findUnique = async ({ where = {}, include = {} } = {}) => {
    const row = state.matchScoringProfiles.find((item) => item.id === where.id) || null;
    if (!row) return null;
    return {
      ...clone(row),
      versions: include.versions ? state.matchScoringProfileVersions.filter((item) => item.profileId === row.id).sort((a, b) => b.version - a.version).map(clone) : undefined,
    };
  };
  prisma.matchScoringProfileVersion.findFirst = async ({ where = {}, orderBy } = {}) => {
    let rows = state.matchScoringProfileVersions.filter((item) => (!where.id || item.id === where.id) && (!where.organisationId || item.organisationId === where.organisationId) && (!where.profileId || item.profileId === where.profileId));
    if (orderBy?.version === 'desc') rows = rows.sort((a, b) => b.version - a.version);
    return clone(rows[0] || null);
  };
  prisma.matchScoringProfileVersion.create = async ({ data }) => {
    const row = { id: nextId('profile-version'), createdAt: now(), ...clone(data) };
    state.matchScoringProfileVersions.push(row);
    return clone(row);
  };
  prisma.matchScoringProfileVersion.update = async ({ where, data }) => {
    const row = state.matchScoringProfileVersions.find((item) => item.id === where.id);
    applyData(row, clone(data));
    return clone(row);
  };

  prisma.recruiterMatchOverride.findFirst = async ({ where = {}, orderBy } = {}) => {
    let rows = state.recruiterMatchOverrides.filter((item) => (!where.organisationId || item.organisationId === where.organisationId) && (!where.candidateId || item.candidateId === where.candidateId) && (!where.jobId || item.jobId === where.jobId));
    if (orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return clone(rows[0] || null);
  };
  prisma.recruiterMatchOverride.findMany = async ({ where = {}, orderBy } = {}) => {
    let rows = state.recruiterMatchOverrides.filter((item) => (!where.organisationId || item.organisationId === where.organisationId) && (!where.candidateId || item.candidateId === where.candidateId) && (!where.jobId || item.jobId === where.jobId));
    if (orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows.map(clone);
  };
  prisma.recruiterMatchOverride.create = async ({ data }) => {
    const row = { id: nextId('override'), createdAt: now(), ...clone(data) };
    state.recruiterMatchOverrides.push(row);
    return clone(row);
  };

  prisma.candidateRankingSnapshot.findFirst = async ({ where = {}, orderBy } = {}) => {
    let rows = state.candidateRankingSnapshots.filter((item) => (!where.organisationId || item.organisationId === where.organisationId) && (!where.jobId || item.jobId === where.jobId));
    if (orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return clone(rows[0] || null);
  };
  prisma.candidateRankingSnapshot.create = async ({ data }) => {
    const row = { id: nextId('snapshot'), createdAt: now(), updatedAt: now(), generatedAt: null, completedAt: null, staleReason: null, ...clone(data) };
    state.candidateRankingSnapshots.push(row);
    return clone(row);
  };
  prisma.candidateRankingSnapshot.findUnique = async ({ where = {} } = {}) => clone(state.candidateRankingSnapshots.find((item) => item.id === where.id) || null);
  prisma.candidateRankingSnapshot.update = async ({ where, data }) => {
    const row = state.candidateRankingSnapshots.find((item) => item.id === where.id);
    applyData(row, clone(data));
    return clone(row);
  };

  prisma.candidateRankingEntry.findMany = async ({ where = {}, include = {}, orderBy = [] } = {}) => {
    let rows = state.candidateRankingEntries.filter((item) => (!where.snapshotId || item.snapshotId === where.snapshotId) && (!where.organisationId || item.organisationId === where.organisationId));
    if (orderBy[0]?.effectiveOverallScore === 'desc') rows = rows.sort((a, b) => b.effectiveOverallScore - a.effectiveOverallScore || a.rank - b.rank);
    else if (orderBy[0]?.confidenceScore === 'desc') rows = rows.sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0) || a.rank - b.rank);
    else rows = rows.sort((a, b) => a.rank - b.rank);
    return rows.map((row) => ({ ...clone(row), candidate: include.candidate ? clone(state.candidates.find((item) => item.id === row.candidateId) || null) : undefined }));
  };
  prisma.candidateRankingEntry.create = async ({ data }) => {
    const row = { id: nextId('entry'), createdAt: now(), updatedAt: now(), ...clone(data) };
    state.candidateRankingEntries.push(row);
    return clone(row);
  };
  prisma.candidateRankingEntry.deleteMany = async ({ where = {} } = {}) => {
    const before = state.candidateRankingEntries.length;
    state.candidateRankingEntries = state.candidateRankingEntries.filter((item) => item.snapshotId !== where.snapshotId);
    return { count: before - state.candidateRankingEntries.length };
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
  ({ getCandidateJobMatch, runCandidateJobMatchGenerationTask } = await import('../intelligence/services/candidateMatchEngineService.js'));
  ({
    createMatchScoringProfile,
    createMatchScoringProfileVersion,
    activateMatchScoringProfile,
    getMatchScoringProfile,
  } = await import('../intelligence/services/matchScoringProfileService.js'));
  ({ createRecruiterMatchOverride, listRecruiterMatchOverrides } = await import('../intelligence/services/recruiterMatchOverrideService.js'));
  ({
    generateCandidateRanking,
    getCandidateRanking,
    getCandidateRankingStatus,
    runJobCandidateRankingGenerationTask,
  } = await import('../intelligence/services/candidateRankingService.js'));
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

test('scoring profiles support versioned create and activation', async () => {
  const created = await createMatchScoringProfile(adminActor(), {
    key: 'backend-default',
    name: 'Backend Default',
    description: 'Profile for backend jobs',
    isActive: true,
    title: 'v1',
    weightsJson: {
      requiredSkills: { enabled: true, weight: 0.4 },
      preferredSkills: { enabled: true, weight: 0.1 },
      experience: { enabled: true, weight: 0.2 },
      roleTitle: { enabled: true, weight: 0.1 },
      location: { enabled: true, weight: 0.08 },
      workMode: { enabled: true, weight: 0.04 },
      employmentType: { enabled: true, weight: 0.03 },
      noticePeriod: { enabled: true, weight: 0.03 },
      compensation: { enabled: true, weight: 0.02 },
      education: { enabled: false, weight: 0 },
    },
    knockoutRulesJson: {},
    thresholdsJson: {},
    confidenceRulesJson: {},
  });

  const version = await createMatchScoringProfileVersion(adminActor(), {
    profileId: created.id,
    title: 'v2',
    weightsJson: {
      requiredSkills: { enabled: true, weight: 0.35 },
      preferredSkills: { enabled: true, weight: 0.15 },
      experience: { enabled: true, weight: 0.2 },
      roleTitle: { enabled: true, weight: 0.1 },
      location: { enabled: true, weight: 0.08 },
      workMode: { enabled: true, weight: 0.04 },
      employmentType: { enabled: true, weight: 0.03 },
      noticePeriod: { enabled: true, weight: 0.03 },
      compensation: { enabled: true, weight: 0.02 },
      education: { enabled: false, weight: 0 },
    },
    knockoutRulesJson: {},
    thresholdsJson: {},
    confidenceRulesJson: {},
    activate: true,
  });

  const activated = await activateMatchScoringProfile(adminActor(), {
    profileId: created.id,
    versionId: version.id,
    active: true,
  });
  const detail = await getMatchScoringProfile(adminActor(), { profileId: created.id });

  assert.equal(created.versions.length, 1);
  assert.equal(version.version, 2);
  assert.equal(activated.activeVersionId, version.id);
  assert.equal(detail.activeVersionId, version.id);
});

test('recruiter overrides preserve generated match output and return effective values separately', async () => {
  await getCandidateJobMatch(adminActor(), { candidateId: 'candidate-1', jobId: 'job-1' });
  await runCandidateJobMatchGenerationTask(state.backgroundTasks[0]);

  const override = await createRecruiterMatchOverride(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
    type: 'SCORE_ADJUSTMENT',
    scoreDelta: -20,
    reason: 'Reduce score after recruiter review.',
  });

  const generatedScore = state.intelligenceResults[0].normalizedOutput.overallScore.score;
  assert.equal(override.generated.overallScore.score, generatedScore);
  assert.equal(override.effective.overallScore.score, generatedScore - 20);

  const overrides = await listRecruiterMatchOverrides(adminActor(), {
    candidateId: 'candidate-1',
    jobId: 'job-1',
  });
  assert.equal(overrides.length, 1);
  assert.equal(state.intelligenceResults[0].normalizedOutput.effective, undefined);
});

test('ranking generation creates a pending snapshot and queues a background task', async () => {
  const ranking = await generateCandidateRanking(adminActor(), { jobId: 'job-1' });
  assert.equal(ranking.snapshot.status, 'PENDING');
  assert.equal(ranking.snapshot.totalCandidates, 2);
  assert.equal(ranking.queued, true);
  assert.equal(state.backgroundTasks.at(-1).type, 'JOB_CANDIDATE_RANKING_GENERATION');
});

test('ranking worker materializes entries from persisted match results and sorts deterministically', async () => {
  const ranking = await generateCandidateRanking(adminActor(), { jobId: 'job-1' });
  const task = state.backgroundTasks.find((item) => item.entityId === ranking.snapshot.id);
  const outcome = await runJobCandidateRankingGenerationTask(task);
  const listed = await getCandidateRanking(adminActor(), {
    jobId: 'job-1',
    page: 1,
    pageSize: 20,
    sort: 'rank',
  });
  const status = await getCandidateRankingStatus(adminActor(), { jobId: 'job-1' });

  assert.equal(outcome, 'success');
  assert.equal(status.status, 'READY');
  assert.equal(listed.entries.length, 2);
  assert.equal(listed.entries[0].candidateId, 'candidate-1');
  assert.equal(listed.entries[0].rank, 1);
  assert.equal(listed.entries[1].candidateId, 'candidate-2');
});
