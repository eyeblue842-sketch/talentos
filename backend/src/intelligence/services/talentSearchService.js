import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { enforceIntelligenceUsageLimits, assertIntelligenceInputLength } from './usageService.js';

function sentenceCase(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractRange(text) {
  const match = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s+years?/i);
  if (!match) return {};
  return {
    minExperience: Number(match[1]),
    maxExperience: Number(match[2]),
  };
}

function extractLocation(text) {
  const match = text.match(/\b(?:in|at)\s+([A-Za-z\s]+?)(?:\s+with|\s+\d|\s+available|$)/i);
  return match ? sentenceCase(match[1].trim()) : '';
}

function extractNotice(text) {
  const match = text.match(/(?:notice period|available)\s+(?:under|within|in)?\s*(\d+)\s+days?/i);
  if (!match) return {};
  const days = Number(match[1]);
  if (days <= 0) return { availability: 'IMMEDIATE', noticePeriodDaysMax: 0 };
  if (days <= 15) return { availability: 'TWO_WEEKS', noticePeriodDaysMax: days };
  if (days <= 30) return { availability: 'ONE_MONTH', noticePeriodDaysMax: days };
  return { noticePeriodDaysMax: days };
}

function extractSkills(text) {
  const sources = ['Java', 'Spring Boot', 'AWS', 'React', 'Node.js', 'PostgreSQL', 'Figma', 'Python', 'Golang', 'Kubernetes', 'Kafka'];
  return sources.filter((skill) => new RegExp(skill.replace('.', '\\.'), 'i').test(text));
}

function extractWorkMode(text) {
  if (/remote/i.test(text)) return 'REMOTE';
  if (/hybrid/i.test(text)) return 'HYBRID';
  if (/onsite|on-site/i.test(text)) return 'ONSITE';
  return null;
}

export function buildDeterministicQueryParse(query) {
  return {
    keyword: query,
    skills: extractSkills(query),
    location: extractLocation(query),
    workMode: extractWorkMode(query),
    currentTitle: /developer|engineer|designer|manager|recruiter/i.test(query) ? sentenceCase(query.match(/(developer|engineer|designer|manager|recruiter)/i)?.[0] || '') : '',
    interpretedFilters: [
      extractLocation(query) ? `Location: ${extractLocation(query)}` : null,
      extractSkills(query).length ? `Skills: ${extractSkills(query).join(', ')}` : null,
    ].filter(Boolean),
    warnings: [],
    education: '',
    certifications: [],
    applicationStatus: null,
    talentPool: '',
    recencyDays: null,
    ...extractRange(query),
    ...extractNotice(query),
  };
}

export async function parseTalentSearchQuery(actorUser, payload) {
  const context = await requireIntelligenceFeature(actorUser, 'TALENT_SEARCH', null, 'generate');
  assertIntelligenceInputLength(payload.query);

  const deterministic = buildDeterministicQueryParse(payload.query);
  const sourceFingerprint = createFingerprint({
    query: payload.query,
    jobId: payload.jobId || null,
    requisitionId: payload.requisitionId || null,
  });
  const entityId = payload.jobId || payload.requisitionId || 'search-query';

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'TalentSearchParse',
      entityId,
      sourceFingerprint,
      resultVersion: 'talent-search-parse-v1',
      promptVersion: '1.0.0',
    });
    if (cached) {
      return {
        executionId: cached.executionId,
        fromCache: true,
        generatedAt: cached.createdAt,
        ...cached.normalizedOutput,
      };
    }
  }

  if (context.enabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.organisationId,
      userId: actorUser.id,
      feature: 'TALENT_SEARCH',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'TALENT_SEARCH',
    promptKey: 'TALENT_SEARCH_QUERY_PARSE',
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    inputPayload: payload,
  });

  try {
    let assisted = null;
    let usage = {};
    if (context.enabled) {
      const runtime = await executeStructuredPrompt({
        promptKey: 'TALENT_SEARCH_QUERY_PARSE',
        input: {
          query: payload.query,
          allowlistedFields: ['skills', 'experience range', 'location', 'work mode', 'notice period', 'current title', 'education', 'certifications', 'application status', 'talent pool', 'recency', 'availability'],
        },
      });
      assisted = runtime.output;
      usage = {
        promptTokens: runtime.promptTokens,
        completionTokens: runtime.completionTokens,
        latencyMs: runtime.latencyMs,
        outputCharacterCount: runtime.rawText.length,
      };
    }

    const finalOutput = {
      ...deterministic,
      ...(assisted || {}),
      generatedLabel: assisted ? 'AI-generated suggestion. Review before use.' : 'Deterministic interpreted filters. AI enhancement unavailable.',
    };

    await supersedeCachedResults({
      organisationId: context.organisationId,
      entityType: 'TalentSearchParse',
      entityId,
      resultVersion: 'talent-search-parse-v1',
    });

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'TalentSearchParse',
      entityId,
      sourceFingerprint,
      resultVersion: 'talent-search-parse-v1',
      promptVersion: '1.0.0',
      normalizedOutput: finalOutput,
      explanation: finalOutput.interpretedFilters?.join('; ') || finalOutput.keyword,
      feature: 'TALENT_SEARCH',
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.enabled ? 'SUCCEEDED' : 'SKIPPED',
      ...usage,
      outputCharacterCount: JSON.stringify(finalOutput).length,
    });

    return {
      executionId: execution.id,
      resultId: stored.id,
      fromCache: false,
      generatedAt: stored.createdAt,
      ...finalOutput,
    };
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error);
    throw error;
  }
}
