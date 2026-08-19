import { resumeSearchV2ResponseSchema } from '@careeriz/shared';
import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../auditLogService.js';
import { createSignedSearchCursor, parseSignedSearchCursor } from './cursor.js';
import { compileResumeSearchV2Query } from './queryCompiler.js';
import { RESUME_SEARCH_INDEX_SCHEMA_VERSION } from './mapping.js';
import { resumeSearchAdapter } from './openSearchAdapter.js';
import { buildResumeSearchVisibilityFilter, hasResumeSearchEntitlement } from './visibility.js';

function sanitizeHighlightSnippet(value = '') {
  return String(value || '')
    .replace(/<(?!\/?mark\b)[^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// Strips all ASCII control characters (0x00-0x1F, 0x7F), including
// tab/newline/CR, from already-flattened single-line result text.
// Written as a code-point filter rather than a regex control-char
// range so no-control-regex has nothing to flag.
function isAsciiControlCodePoint(code) {
  return (code >= 0x00 && code <= 0x1f) || code === 0x7f;
}

function stripAsciiControlCharacters(value) {
  let result = '';
  for (const char of value) {
    if (!isAsciiControlCodePoint(char.codePointAt(0))) result += char;
  }
  return result;
}

export function sanitizePlainResultText(value = '', maxLength = 240) {
  return stripAsciiControlCharacters(
    String(value || '')
      .replace(/<\/?mark\b[^>]*>/gi, '')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeResultTextList(values = [], { maxItems = 20, maxLength = 160 } = {}) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => sanitizePlainResultText(value, maxLength))
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .slice(0, maxItems);
}

function canUseSalaryFilters(actorUser) {
  const role = actorUser?.activeMembership?.role;
  return ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(role) || ['ADMIN', 'PLATFORM_ADMIN'].includes(actorUser?.role);
}

function explainMatchedTerms(item, payload) {
  const textByField = {
    normalizedSkills: (item._source?.normalizedSkills || []).join(' '),
    currentTitle: item._source?.currentTitle || '',
    previousTitles: (item._source?.previousTitles || []).join(' '),
    employmentHistoryText: item._source?.employmentHistoryText || '',
    projectsText: item._source?.projectsText || '',
    certifications: (item._source?.certifications || []).join(' '),
  };
  const explanations = [];
  for (const keyword of payload.keywords) {
    const lowered = keyword.term.toLowerCase();
    const field = Object.keys(textByField).find((name) => textByField[name].toLowerCase().includes(lowered));
    if (!field) continue;
    const prefix = keyword.mode === 'MUST' ? 'Matched required' : keyword.mode === 'MUST_NOT' ? 'Excluded' : 'Matched optional';
    explanations.push({ field, text: `${prefix} ${keyword.term} in ${field}` });
  }
  for (const phrase of payload.phrases || []) {
    const lowered = phrase.term.toLowerCase();
    const field = Object.keys(textByField).find((name) => textByField[name].toLowerCase().includes(lowered));
    if (!field) continue;
    const prefix = phrase.mode === 'MUST' ? 'Exact required phrase' : phrase.mode === 'MUST_NOT' ? 'Excluded phrase' : 'Exact optional phrase';
    explanations.push({ field, text: `${prefix} ${phrase.term} matched in ${field}` });
  }
  return explanations.slice(0, 20);
}

export async function searchResumesV2(actorUser, rawPayload, requestMeta = {}) {
  const entitlement = hasResumeSearchEntitlement(actorUser);
  if (!entitlement.allowed) {
    const error = new Error('Organisation membership required.');
    error.statusCode = 403;
    throw error;
  }

  const allowSalaryFilters = canUseSalaryFilters(actorUser);
  if (!allowSalaryFilters && (rawPayload?.filters?.salaryMin != null || rawPayload?.filters?.salaryMax != null)) {
    const error = new Error('Salary filters are not authorized.');
    error.statusCode = 403;
    error.code = 'RESUME_SEARCH_SALARY_FILTER_UNAUTHORIZED';
    throw error;
  }

  const compiled = compileResumeSearchV2Query(rawPayload, { allowSalaryFilters });
  compiled.searchRequest.query.bool.filter.push(buildResumeSearchVisibilityFilter({
    actorUser,
    organisationId: actorUser?.activeMembership?.organisationId || null,
  }));
  const cursorState = rawPayload?.cursor ? parseSignedSearchCursor(rawPayload.cursor, compiled.queryFingerprint) : null;
  const pitId = cursorState?.pitId || await resumeSearchAdapter.openPointInTime();

  try {
    const body = await resumeSearchAdapter.searchResumes({
      searchRequest: compiled.searchRequest,
      pitId,
      searchAfter: cursorState?.sa || null,
    });

    const items = await Promise.all((body.hits?.hits || []).map(async (hit) => {
      const source = hit._source || {};
      const safeHighlights = Object.entries(hit.highlight || {})
        .filter(([field]) => ['normalizedSkills', 'currentTitle', 'previousTitles', 'employmentHistoryText', 'projectsText', 'certifications'].includes(field))
        .map(([field, snippets]) => ({ field, snippets: (snippets || []).map(sanitizeHighlightSnippet).filter(Boolean) }));

      return {
        documentId: source.documentId || hit._id,
        candidateId: source.candidateId,
        normalizedName: sanitizePlainResultText(source.normalizedName, 240) || null,
        currentTitle: sanitizePlainResultText(source.currentTitle, 240) || null,
        currentEmployer: sanitizePlainResultText(source.currentEmployer, 240) || null,
        currentLocation: sanitizePlainResultText(source.currentLocation, 200) || null,
        totalExperienceMonths: source.totalExperienceMonths ?? null,
        normalizedSkills: sanitizeResultTextList(source.normalizedSkills, { maxItems: 20, maxLength: 120 }),
        educationSummary: sanitizePlainResultText(source.educationSummary, 400) || null,
        certifications: sanitizeResultTextList(source.certifications, { maxItems: 20, maxLength: 160 }),
        reviewRequired: Boolean(source.reviewRequired),
        parsingConfidence: source.parsingConfidence ?? null,
        resumeUpdatedAt: source.resumeUpdatedAt || null,
        profileUpdatedAt: source.profileUpdatedAt || null,
        highlights: safeHighlights,
        explanations: explainMatchedTerms(hit, compiled.payload),
        score: hit._score ?? null,
      };
    }));

    const lastSort = body.hits?.hits?.length ? body.hits.hits[body.hits.hits.length - 1].sort : null;
    const nextCursor = lastSort ? createSignedSearchCursor({
      pitId,
      searchAfter: lastSort,
      queryFingerprint: compiled.queryFingerprint,
    }) : null;
    if (!nextCursor) {
      await resumeSearchAdapter.closePointInTime(pitId);
    }

    await recordAuditLog({
      organisationId: actorUser.activeMembership?.organisationId || null,
      actorUserId: actorUser.id,
      action: 'resume-search.v2.execute',
      entityType: 'ResumeSearchV2Query',
      entityId: compiled.queryFingerprint,
      metadata: {
        keywordCount: compiled.payload.keywords.length,
        phraseCount: compiled.payload.phrases.length,
        filterKeys: Object.keys(compiled.payload.filters || {}).filter((key) => {
          const value = compiled.payload.filters[key];
          return Array.isArray(value) ? value.length > 0 : value != null;
        }),
        pageSize: compiled.payload.pageSize,
        resultCount: items.length,
      },
      ...requestMeta,
    }).catch(() => {});

    return resumeSearchV2ResponseSchema.parse({
      items,
      meta: {
        pageSize: compiled.payload.pageSize,
        nextCursor,
        totalRelation: body.hits?.total?.relation === 'gte' ? 'GTE' : 'EQ',
        totalValue: body.hits?.total?.value || 0,
        searchEngine: 'OPENSEARCH',
        indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
        queryFingerprint: compiled.queryFingerprint,
      },
    });
  } catch (error) {
    if (!cursorState?.pitId) {
      await resumeSearchAdapter.closePointInTime(pitId);
    }
    throw error;
  }
}

export async function listResumeSearchIndexHealth() {
  const [engineHealth, pendingIndexTaskCount, failedIndexCount, oldestPending, latestIndexed] = await Promise.all([
    resumeSearchAdapter.getIndexHealth(),
    prisma.backgroundTask.count({ where: { type: 'RESUME_SEARCH_INDEX_SYNC', status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] } } }).catch(() => 0),
    prisma.resumeSearchIndexState.count({ where: { status: 'FAILED' } }).catch(() => 0),
    prisma.resumeSearchIndexState.findFirst({
      where: { status: { in: ['PENDING', 'RETRY_SCHEDULED'] } },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true },
    }).catch(() => null),
    prisma.resumeSearchIndexState.findFirst({
      where: { status: 'INDEXED' },
      orderBy: { indexedAt: 'desc' },
      select: { indexedAt: true },
    }).catch(() => null),
  ]);

  return {
    ...engineHealth,
    indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
    pendingIndexTaskCount,
    failedIndexCount,
    oldestPendingAgeMs: oldestPending?.updatedAt ? Math.max(0, Date.now() - oldestPending.updatedAt.getTime()) : null,
    lastSuccessfulIndexAt: latestIndexed?.indexedAt?.toISOString?.() || null,
  };
}
