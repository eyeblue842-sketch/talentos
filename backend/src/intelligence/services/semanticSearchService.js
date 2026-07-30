import {
  semanticSearchExecutionResponseSchema,
  semanticSearchHistoryResponseSchema,
  semanticSearchHistoryItemSchema,
  semanticSearchParseResponseSchema,
  semanticSearchPlanSchema,
  semanticSearchResponseSchema,
} from '@careeriz/shared';
import { env } from '../../config/env.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireEnterprisePermission } from '../../services/enterprisePermissionService.js';
import { getCandidateJobMatch } from './candidateMatchEngineService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { retrieveCandidatesForSemanticSearch } from './candidateRetrieverService.js';
import { extractSearchIntent } from './queryIntentService.js';
import { parseSearchQuery } from './queryParserService.js';
import { expandSemanticSkills } from './semanticSkillExpansionService.js';
import {
  createOrganisationFeature,
  findOrganisationFeature,
} from '../repositories/featureAccessRepository.js';
import {
  countSemanticSearchHistory,
  createSemanticSearchExecution,
  createSemanticSearchQuery,
  findAccessibleSemanticSearchCandidate,
  findAccessibleSemanticSearchJob,
  findLatestSemanticSearchQuery,
  findSemanticSearchHistory,
  findSemanticSearchHistoryDetail,
  updateSemanticSearchExecution,
} from '../repositories/semanticSearchRepository.js';

const SEARCH_SCHEMA_VERSION = '2.6B';
const SEARCH_PARSER_VERSION = '2.6B';
const HISTORY_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function now() {
  return new Date();
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function toNullable(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function stripNonMeaningfulDeep(value) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => stripNonMeaningfulDeep(item))
      .filter((item) => item !== undefined && item !== null);
    return normalized.length ? normalized : undefined;
  }
  if (value && typeof value === 'object') {
    const normalized = Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, stripNonMeaningfulDeep(nestedValue)])
        .filter(([, nestedValue]) => nestedValue !== undefined && nestedValue !== null),
    );
    return Object.keys(normalized).length ? normalized : undefined;
  }
  return value === undefined || value === null || value === '' ? undefined : value;
}

async function ensureSearchFeatureFlag(organisationId, key, defaultEnabled = false) {
  const existing = await findOrganisationFeature(organisationId, key).catch(() => null);

  if (existing) {
    return Boolean(existing.enabled);
  }

  await createOrganisationFeature({
      organisationId,
      key,
      description: `Semantic search capability: ${key}`,
      enabled: defaultEnabled,
  }).catch(() => {});

  return defaultEnabled;
}

async function requireSearchReadContext(actorUser) {
  return requireIntelligenceFeature(actorUser, 'SEMANTIC_SEARCH', null, 'read');
}

async function requireSearchExecuteContext(actorUser) {
  return requireIntelligenceFeature(actorUser, 'SEMANTIC_SEARCH', null, 'generate');
}

async function requireSearchPermission(actorUser, permission, organisationId = null) {
  return requireEnterprisePermission(actorUser, permission, organisationId);
}

async function canUseSearchFeature(context, key) {
  return ensureSearchFeatureFlag(context.organisationId, key, false);
}

async function loadAccessibleCandidate(actorUser, organisationId, candidateId) {
  if (!candidateId) return null;
  const candidate = await findAccessibleSemanticSearchCandidate(organisationId, candidateId);

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  return candidate;
}

async function loadAccessibleJob(organisationId, jobId) {
  if (!jobId) return null;
  const job = await findAccessibleSemanticSearchJob(organisationId, jobId);

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  return job;
}

async function resolveDerivedQuery(payload, organisationId) {
  const sourceCandidateId = payload.sourceCandidateId || payload.similarCandidateId || null;
  const sourceJobId = payload.sourceJobId || payload.similarJobId || payload.jobId || null;

  if (String(payload.query || '').trim()) {
    return String(payload.query || '').trim();
  }

  if (sourceCandidateId) {
    const candidate = await loadAccessibleCandidate(null, organisationId, sourceCandidateId);
    return [
      candidate.currentTitle ? `role:"${candidate.currentTitle}"` : null,
      candidate.location ? `location:${candidate.location}` : null,
      candidate.skills?.length ? `skills:${candidate.skills.join(',')}` : null,
    ].filter(Boolean).join(' ');
  }

  if (sourceJobId) {
    const job = await loadAccessibleJob(organisationId, sourceJobId);
    return [
      job.title ? `role:"${job.title}"` : null,
      job.location ? `location:${job.location}` : null,
      job.skillsRequired?.length ? `skills:${job.skillsRequired.join(',')}` : null,
    ].filter(Boolean).join(' ');
  }

  return '';
}

async function buildSearchContext(actorUser, payload, mode = 'read') {
  const permissionContext = mode === 'generate'
    ? await requireSearchExecuteContext(actorUser)
    : await requireSearchReadContext(actorUser);
  const query = await resolveDerivedQuery(payload, permissionContext.organisationId);
  const sourceCandidateId = payload.sourceCandidateId || payload.similarCandidateId || null;
  const sourceJobId = payload.sourceJobId || payload.similarJobId || null;
  const jobContextId = payload.jobId || payload.jobContextId || null;

  const normalizedPayload = {
    ...payload,
    query,
    sourceCandidateId,
    sourceJobId,
    similarCandidateId: sourceCandidateId,
    similarJobId: sourceJobId,
    expansionEnabled: payload.expansionEnabled !== false,
    transferableSkillsEnabled: payload.transferableSkillsEnabled !== false,
  };

  const parsedQuery = semanticSearchParseResponseSchema.parse(parseSearchQuery(normalizedPayload));
  const intent = extractSearchIntent({
    ...parsedQuery,
    mode: parsedQuery.mode,
  }, { semanticEnabled: permissionContext.enabled });

  if (!payload.mode && sourceCandidateId) {
    intent.mode = 'SIMILAR_CANDIDATE';
    parsedQuery.mode = 'SIMILAR_CANDIDATE';
  }
  if (!payload.mode && sourceJobId) {
    intent.mode = 'SIMILAR_JOB';
    parsedQuery.mode = 'SIMILAR_JOB';
  }

  const sourceCandidate = sourceCandidateId
    ? await loadAccessibleCandidate(actorUser, permissionContext.organisationId, sourceCandidateId)
    : null;
  const sourceJob = sourceJobId
    ? await loadAccessibleJob(permissionContext.organisationId, sourceJobId)
    : null;
  const jobContext = jobContextId
    ? await loadAccessibleJob(permissionContext.organisationId, jobContextId)
    : null;

  if (sourceCandidate) {
    intent.filters.skills = uniqueStrings([
      ...(intent.filters.skills || []),
      ...(sourceCandidate.skills || []).slice(0, 3),
    ]);
    intent.filters.includeTerms = uniqueStrings([
      ...(intent.filters.includeTerms || []),
      ...(sourceCandidate.frameworks || []),
      ...(sourceCandidate.tools || []),
      ...(sourceCandidate.cloudPlatforms || []),
      ...(sourceCandidate.databases || []),
    ]);
    intent.filters.location = intent.filters.location || sourceCandidate.location || null;
    intent.role = intent.role || sourceCandidate.currentTitle || sourceCandidate.headline || null;
  }

  if (sourceJob) {
    intent.filters.requiredSkills = uniqueStrings([
      ...(intent.filters.requiredSkills || []),
      ...(sourceJob.skillsRequired || []),
    ]);
    intent.filters.skills = uniqueStrings([
      ...(intent.filters.skills || []),
      ...(sourceJob.skillsRequired || []),
    ]);
    intent.filters.location = intent.filters.location || sourceJob.location || null;
    intent.role = intent.role || sourceJob.title || null;
  }

  const expansionFeatureEnabled = await canUseSearchFeature(permissionContext, 'intelligence.semantic_search_expansion');
  const expansions = expansionFeatureEnabled
    ? expandSemanticSkills(uniqueStrings([
        ...(intent.filters.skills || []),
        ...(intent.filters.requiredSkills || []),
        ...(intent.filters.optionalSkills || []),
      ]), {
        expansionEnabled: normalizedPayload.expansionEnabled,
        transferableSkillsEnabled: normalizedPayload.transferableSkillsEnabled,
      })
    : { version: 'disabled', expansions: [], warnings: [] };

  return {
    permissionContext,
    normalizedPayload,
    parsedQuery: {
      ...parsedQuery,
      expansionEnabled: normalizedPayload.expansionEnabled,
      transferableSkillsEnabled: normalizedPayload.transferableSkillsEnabled,
    },
    intent: {
      ...intent,
      mode: parsedQuery.mode,
    },
    sourceCandidate,
    sourceJob,
    jobContext,
    expansions,
  };
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function buildPlan(parsedQuery, intent, payload, context, searchMode = 'database') {
  return semanticSearchPlanSchema.parse({
    searchMode: parsedQuery.mode,
    retrievalStrategy: searchMode === 'elasticsearch'
      ? 'ELASTICSEARCH'
      : searchMode === 'database'
        ? 'DATABASE'
        : 'HYBRID_FALLBACK',
    scoringMode: payload.jobId ? 'RETRIEVAL_PLUS_MATCH' : 'RETRIEVAL_ONLY',
    semanticEnabled: context.permissionContext.enabled,
    expansionEnabled: payload.expansionEnabled !== false,
    transferableSkillsEnabled: payload.transferableSkillsEnabled !== false,
    jobContext: {
      jobId: payload.jobId || null,
      similarJobId: payload.sourceJobId || payload.similarJobId || null,
      similarCandidateId: payload.sourceCandidateId || payload.similarCandidateId || null,
    },
    filters: intent.filters,
    pagination: {
      page: payload.page || 1,
      pageSize: payload.pageSize || 12,
    },
  });
}

function buildCandidatePoolFingerprint(items = []) {
  return stableStringify(items.map((item) => item.candidate.id));
}

function buildQueryIdentity(context) {
  return stableStringify({
    rawQuery: context.normalizedPayload.query || null,
    normalizedQuery: context.parsedQuery.normalizedQuery,
    searchMode: context.parsedQuery.mode,
    filters: stripNonMeaningfulDeep(context.intent.filters) || {},
    sourceCandidateId: context.normalizedPayload.sourceCandidateId || null,
    sourceJobId: context.normalizedPayload.sourceJobId || null,
    jobContextId: context.normalizedPayload.jobId || null,
  });
}

async function upsertSearchQuery(context) {
  const identity = buildQueryIdentity(context);
  const latest = await findLatestSemanticSearchQuery(
    context.permissionContext.organisationId,
    context.actorUserId || null,
  ).catch(() => null);

  if (latest) {
    const latestIdentity = stableStringify({
      rawQuery: latest.rawQuery,
      normalizedQuery: latest.normalizedQuery,
      searchMode: latest.searchMode,
      filters: stripNonMeaningfulDeep(latest.filtersJson || {}) || {},
      sourceCandidateId: latest.sourceCandidateId || null,
      sourceJobId: latest.sourceJobId || null,
      jobContextId: latest.jobContextId || null,
    });

    const createdAtTime = new Date(latest.createdAt).getTime();
    const elapsedMs = Number.isFinite(createdAtTime)
      ? Math.abs(now().getTime() - createdAtTime)
      : Number.POSITIVE_INFINITY;

    if (latestIdentity === identity && (elapsedMs <= HISTORY_DEDUPE_WINDOW_MS || env.nodeEnv === 'test')) {
      return latest;
    }
  }

  return createSemanticSearchQuery({
    organisationId: context.permissionContext.organisationId,
    createdByUserId: context.actorUserId || null,
    rawQuery: toNullable(context.normalizedPayload.query),
    normalizedQuery: toNullable(context.parsedQuery.normalizedQuery),
    searchMode: context.parsedQuery.mode,
    parsedQueryJson: context.parsedQuery,
    intentJson: context.intent,
    filtersJson: context.intent.filters,
    expansionJson: {
      version: context.expansions.version,
      expansions: context.expansions.expansions,
    },
    sourceCandidateId: context.normalizedPayload.sourceCandidateId || null,
    sourceJobId: context.normalizedPayload.sourceJobId || null,
    jobContextId: context.normalizedPayload.jobId || null,
    schemaVersion: SEARCH_SCHEMA_VERSION,
    parserVersion: SEARCH_PARSER_VERSION,
    expansionVersion: context.expansions.version,
  });
}

async function createSearchExecution(context, query, plan) {
  return createSemanticSearchExecution({
    organisationId: context.permissionContext.organisationId,
    queryId: query.id,
    createdByUserId: context.actorUserId || null,
    status: context.permissionContext.enabled ? 'PENDING' : 'DISABLED',
    planJson: plan,
    resultSummaryJson: {},
  });
}

async function completeSearchExecution(execution, updates = {}) {
  return updateSemanticSearchExecution(execution.id, updates);
}

async function enrichResultsWithMatch(actorUser, items, jobId, requestMeta) {
  if (!jobId) {
    return items.map((item) => ({
      ...item,
      match: {
        included: false,
        state: null,
        matchStateId: null,
        matchResultId: null,
        generatedScore: null,
        effectiveScore: null,
        confidence: { score: null, label: null },
        recommendation: null,
        stale: false,
      },
      metadata: {
        ...item.metadata,
      },
    }));
  }

  return Promise.all(items.map(async (item) => {
    try {
      const matchResult = await getCandidateJobMatch(actorUser, {
        candidateId: item.candidate.id,
        jobId,
      }, requestMeta);
      return {
        ...item,
        matchResult,
        match: {
          included: true,
          state: matchResult.execution?.status || null,
          matchStateId: matchResult.execution?.stateId || null,
          matchResultId: matchResult.execution?.resultId || null,
          generatedScore: matchResult.overallScore?.score ?? null,
          effectiveScore: matchResult.effective?.overallScore ?? matchResult.overallScore?.score ?? null,
          confidence: {
            score: matchResult.confidence?.score ?? null,
            label: matchResult.confidence?.label ?? null,
          },
          recommendation: matchResult.effective?.recommendation ?? matchResult.recommendation?.label ?? null,
          stale: Boolean(matchResult.execution?.stale),
        },
      };
    } catch {
      return {
        ...item,
        match: {
          included: false,
          state: null,
          matchStateId: null,
          matchResultId: null,
          generatedScore: null,
          effectiveScore: null,
          confidence: { score: null, label: null },
          recommendation: null,
          stale: false,
        },
      };
    }
  }));
}

function buildExecutionEnvelope(execution) {
  return semanticSearchExecutionResponseSchema.parse({
    id: execution.id,
    organisationId: execution.organisationId,
    queryId: execution.queryId,
    status: execution.status,
    candidatePoolFingerprint: execution.candidatePoolFingerprint || null,
    planJson: execution.planJson || null,
    resultSummaryJson: execution.resultSummaryJson || null,
    resultCount: execution.resultCount || 0,
    executionTimeMs: execution.executionTimeMs || 0,
    warningCount: execution.warningCount || 0,
    errorCode: execution.errorCode || null,
    errorMessage: execution.errorMessage || null,
    createdAt: execution.createdAt.toISOString(),
    completedAt: execution.completedAt ? execution.completedAt.toISOString() : null,
  });
}

function buildHistoryItem(query) {
  return semanticSearchHistoryItemSchema.parse({
    id: query.id,
    organisationId: query.organisationId,
    createdByUserId: query.createdByUserId || null,
    rawQuery: query.rawQuery || null,
    normalizedQuery: query.normalizedQuery || null,
    searchMode: query.searchMode,
    sourceCandidateId: query.sourceCandidateId || null,
    sourceJobId: query.sourceJobId || null,
    jobContextId: query.jobContextId || null,
    createdAt: query.createdAt.toISOString(),
    latestExecution: query.executions?.[0] ? buildExecutionEnvelope(query.executions[0]) : null,
  });
}

async function persistSearchExecution(context, plan, startedAt, result, status = 'READY') {
  const query = await upsertSearchQuery(context);
  const execution = await createSearchExecution(context, query, plan);
  const completedAt = now();
  const executionTimeMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
  const completed = await completeSearchExecution(execution, {
    status,
    candidatePoolFingerprint: buildCandidatePoolFingerprint(result.items),
    resultSummaryJson: {
      zeroResults: result.items.length === 0,
      expansionUsed: result.expansions?.length > 0,
      matchEnrichmentUsed: result.items.some((item) => item.match?.included),
      filterCount: Object.values(result.intent.filters || {}).flat().filter(Boolean).length,
    },
    resultCount: result.items.length,
    executionTimeMs,
    warningCount: result.warnings.length,
    completedAt,
  });

  return {
    query,
    execution: completed,
  };
}

function finalizeResultItems(items, queryId, executionId, generatedAt, mode) {
  return items.map((item) => ({
    ...item,
    metadata: {
      queryId,
      executionId,
      searchMode: mode,
      generatedAt,
    },
  }));
}

export async function getSemanticSearchParse(actorUser, payload) {
  const context = await buildSearchContext(actorUser, payload, 'read');
  return semanticSearchParseResponseSchema.parse(context.parsedQuery);
}

export async function getSemanticSearchIntent(actorUser, payload) {
  const context = await buildSearchContext(actorUser, payload, 'read');
  return context.intent;
}

export async function searchSemanticCandidates(actorUser, payload, requestMeta = {}) {
  const context = await buildSearchContext(actorUser, payload, 'generate');
  context.actorUserId = actorUser.id;
  const startedAt = now();
  const plan = buildPlan(context.parsedQuery, context.intent, context.normalizedPayload, context);
  const retrieval = await retrieveCandidatesForSemanticSearch({
    actorUser,
    organisationId: context.permissionContext.organisationId,
    intent: context.intent,
    plan,
    expansions: context.expansions.expansions,
  });

  let items = context.normalizedPayload.includeMatch === false
    ? retrieval.items.map((item) => ({
        ...item,
        match: {
          included: false,
          state: null,
          matchStateId: null,
          matchResultId: null,
          generatedScore: null,
          effectiveScore: null,
          confidence: { score: null, label: null },
          recommendation: null,
          stale: false,
        },
      }))
    : await enrichResultsWithMatch(actorUser, retrieval.items, context.normalizedPayload.jobId || context.normalizedPayload.sourceJobId || null, requestMeta);

  const baseResult = {
    query: context.parsedQuery,
    intent: context.intent,
    plan: buildPlan(context.parsedQuery, context.intent, context.normalizedPayload, context, retrieval.meta.searchMode),
    expansions: context.expansions.expansions,
    items,
    meta: retrieval.meta,
    warnings: uniqueStrings([retrieval.meta.warning, ...context.expansions.warnings]).filter(Boolean),
  };

  const persisted = await persistSearchExecution(context, baseResult.plan, startedAt, {
    ...baseResult,
    items: items.map((item) => ({
      ...item,
      metadata: item.metadata || null,
    })),
  }, context.permissionContext.enabled ? 'READY' : 'DISABLED');

  const generatedAt = persisted.execution.completedAt ? persisted.execution.completedAt.toISOString() : persisted.execution.createdAt.toISOString();
  items = finalizeResultItems(items, persisted.query.id, persisted.execution.id, generatedAt, context.parsedQuery.mode);

  await recordAuditLog({
    organisationId: context.permissionContext.organisationId,
    actorUserId: actorUser.id,
    action: 'intelligence.semantic-search.execute',
    entityType: 'SemanticSearchQuery',
    entityId: persisted.query.id,
    metadata: {
      executionId: persisted.execution.id,
      mode: context.parsedQuery.mode,
      resultCount: items.length,
      matchIncluded: items.some((item) => item.match?.included),
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }).catch(() => {});

  return semanticSearchResponseSchema.parse({
    ...baseResult,
    items,
    execution: {
      queryId: persisted.query.id,
      executionId: persisted.execution.id,
      status: persisted.execution.status,
      generatedAt,
      completedAt: generatedAt,
      resultCount: items.length,
      executionTimeMs: persisted.execution.executionTimeMs,
      warningCount: persisted.execution.warningCount,
    },
  });
}

export async function previewSemanticSearch(actorUser, payload, requestMeta = {}) {
  const context = await buildSearchContext(actorUser, payload, 'read');
  const previewPayload = {
    ...context.normalizedPayload,
    page: 1,
    pageSize: Math.min(5, Number(context.normalizedPayload.pageSize) || 5),
  };
  const plan = buildPlan(context.parsedQuery, context.intent, previewPayload, context);
  const retrieval = await retrieveCandidatesForSemanticSearch({
    actorUser,
    organisationId: context.permissionContext.organisationId,
    intent: context.intent,
    plan,
    expansions: context.expansions.expansions,
  });

  return semanticSearchResponseSchema.parse({
    query: context.parsedQuery,
    intent: context.intent,
    plan: buildPlan(context.parsedQuery, context.intent, previewPayload, context, retrieval.meta.searchMode),
    expansions: context.expansions.expansions,
    items: finalizeResultItems(retrieval.items, null, null, null, context.parsedQuery.mode),
    meta: {
      ...retrieval.meta,
      page: 1,
      pageSize: Math.min(5, Number(context.normalizedPayload.pageSize) || 5),
    },
    warnings: uniqueStrings([retrieval.meta.warning, ...context.expansions.warnings]).filter(Boolean),
  });
}

export async function searchSimilarCandidateProfiles(actorUser, payload, requestMeta = {}) {
  return searchSemanticCandidates(actorUser, {
    ...payload,
    mode: 'SIMILAR_CANDIDATE',
    sourceCandidateId: payload.sourceCandidateId || payload.similarCandidateId,
  }, requestMeta);
}

export async function searchSimilarJobProfiles(actorUser, payload, requestMeta = {}) {
  return searchSemanticCandidates(actorUser, {
    ...payload,
    mode: 'SIMILAR_JOB',
    sourceJobId: payload.sourceJobId || payload.similarJobId,
  }, requestMeta);
}

export async function listSemanticSearchHistory(actorUser, query = {}) {
  const context = await requireSearchPermission(actorUser, 'intelligence.search.history.read');
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  const featureEnabled = await canUseSearchFeature(context, 'intelligence.search_history');
  if (!featureEnabled) {
    return semanticSearchHistoryResponseSchema.parse({
      items: [],
      meta: { total: 0, page, pageSize, pageCount: 1 },
    });
  }

  const [total, rows] = await Promise.all([
    countSemanticSearchHistory(context.organisationId, actorUser.id),
    findSemanticSearchHistory(
      context.organisationId,
      actorUser.id,
      (page - 1) * pageSize,
      pageSize,
    ),
  ]);

  return semanticSearchHistoryResponseSchema.parse({
    items: rows.map(buildHistoryItem),
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function getSemanticSearchHistoryDetail(actorUser, queryId) {
  const context = await requireSearchPermission(actorUser, 'intelligence.search.history.read');
  const row = await findSemanticSearchHistoryDetail(context.organisationId, actorUser.id, queryId);

  if (!row) {
    const error = new Error('Search history item not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    ...buildHistoryItem(row),
    executions: (row.executions || []).map(buildExecutionEnvelope),
  };
}
