import {
  analyticsInsightRequestSchema,
  batchCandidateMatchRequestSchema,
  candidateIntelligenceParamsSchema,
  candidateIntelligenceRegenerateSchema,
  candidateIntelligenceRequestSchema,
  candidateJobMatchParamsSchema,
  candidateJobMatchRegenerateSchema,
  candidateJobMatchOverrideSchema,
  candidateMatchRequestSchema,
  candidateRankingGenerateSchema,
  candidateRankingParamsSchema,
  candidateRankingQuerySchema,
  intelligenceFeedbackSchema,
  intelligenceGovernanceQuerySchema,
  interviewIntelligenceRequestSchema,
  jobDescriptionParamsSchema,
  jobDescriptionDraftApplySchema,
  jobDescriptionDraftCreateSchema,
  jobDescriptionDraftParamsSchema,
  jobDescriptionDraftUpdateSchema,
  jobDescriptionRegenerateSchema,
  jobDescriptionRequestSchema,
  jobDescriptionTemplateActivateSchema,
  jobDescriptionTemplateCreateSchema,
  jobDescriptionTemplateParamsSchema,
  jobDescriptionTemplateVersionCreateSchema,
  jobIntelligenceRequestSchema,
  matchScoringProfileActivateSchema,
  matchScoringProfileCreateSchema,
  matchScoringProfileParamsSchema,
  matchScoringProfileVersionCreateSchema,
  naturalLanguageTalentSearchSchema,
  savedCandidateSearchCreateSchema,
  savedCandidateSearchParamsSchema,
  savedCandidateSearchUpdateSchema,
  semanticSearchHistoryParamsSchema,
  semanticSearchHistoryQuerySchema,
  semanticSearchIntentRequestSchema,
  semanticSearchParseRequestSchema,
  semanticSearchRequestSchema,
  semanticSearchSuggestionRequestSchema,
  resumeIntelligenceRequestSchema,
} from '@careeriz/shared';
import { sendSuccess } from '../utils/response.js';
import { getAnalyticsInsight } from '../intelligence/services/analyticsInsightService.js';
import {
  getCandidateIntelligence,
  getCandidateIntelligenceStatus,
  regenerateCandidateIntelligence,
} from '../intelligence/services/candidateIntelligenceService.js';
import {
  getCandidateJobMatch,
  getCandidateJobMatchStatus,
  regenerateCandidateJobMatch,
} from '../intelligence/services/candidateMatchEngineService.js';
import { getBatchCandidateMatchIntelligence, getCandidateMatchIntelligence } from '../intelligence/services/candidateMatchService.js';
import {
  generateCandidateRanking,
  getCandidateRanking,
  getCandidateRankingStatus,
  refreshCandidateRanking,
} from '../intelligence/services/candidateRankingService.js';
import {
  getJobDescription,
  getJobDescriptionStatus,
  regenerateJobDescription,
} from '../intelligence/services/jobDescriptionGenerationService.js';
import {
  activateJobDescriptionTemplate,
  applyJobDescriptionDraft,
  createJobDescriptionDraft,
  createJobDescriptionTemplate,
  createJobDescriptionTemplateVersion,
  getJobDescriptionDraft,
  getJobDescriptionHistory,
  getJobDescriptionTemplate,
  listJobDescriptionDrafts,
  listJobDescriptionTemplates,
  updateJobDescriptionDraft,
} from '../intelligence/services/jobDescriptionManagementService.js';
import {
  activateMatchScoringProfile,
  createMatchScoringProfile,
  createMatchScoringProfileVersion,
  getMatchScoringProfile,
  listMatchScoringProfiles,
} from '../intelligence/services/matchScoringProfileService.js';
import { getIntelligenceGovernanceDashboard } from '../intelligence/services/adminIntelligenceService.js';
import { listCandidateJobMatchOverrides } from '../intelligence/services/candidateMatchResultService.js';
import { recordIntelligenceFeedback } from '../intelligence/services/governanceService.js';
import { getInterviewIntelligence } from '../intelligence/services/interviewIntelligenceService.js';
import { getJobIntelligence } from '../intelligence/services/jobIntelligenceService.js';
import { createRecruiterMatchOverride } from '../intelligence/services/recruiterMatchOverrideService.js';
import { getResumeIntelligence } from '../intelligence/services/resumeIntelligenceService.js';
import { getSemanticSearchSuggestions } from '../intelligence/services/searchQuerySuggestionService.js';
import {
  archiveSavedCandidateSearch,
  createSavedCandidateSearch,
  executeSavedCandidateSearch,
  getSavedCandidateSearch,
  listSavedCandidateSearches,
  updateSavedCandidateSearch,
} from '../intelligence/services/savedCandidateSearchService.js';
import {
  getSemanticSearchHistoryDetail,
  listSemanticSearchHistory,
  getSemanticSearchIntent,
  getSemanticSearchParse,
  previewSemanticSearch,
  searchSimilarCandidateProfiles,
  searchSimilarJobProfiles,
  searchSemanticCandidates,
} from '../intelligence/services/semanticSearchService.js';
import { parseTalentSearchQuery } from '../intelligence/services/talentSearchService.js';
import { getIntelligenceProviderHealth } from '../intelligence/services/providerService.js';

function requestMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

export async function getIntelligenceHealth(req, res, next) {
  try {
    const health = await getIntelligenceProviderHealth();
    return sendSuccess(res, 200, health);
  } catch (error) {
    return next(error);
  }
}

export async function postResumeIntelligence(req, res, next) {
  try {
    const payload = resumeIntelligenceRequestSchema.parse(req.body);
    const data = await getResumeIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateProfileIntelligence(req, res, next) {
  try {
    const params = candidateIntelligenceParamsSchema.parse(req.params);
    const payload = candidateIntelligenceRequestSchema.parse({
      candidateId: params.candidateId,
      kind: req.query.kind,
      includeStale: req.query.includeStale === 'true',
    });
    const data = await getCandidateIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateProfileIntelligenceStatus(req, res, next) {
  try {
    const params = candidateIntelligenceParamsSchema.parse(req.params);
    const data = await getCandidateIntelligenceStatus(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateProfileIntelligenceRegenerate(req, res, next) {
  try {
    const params = candidateIntelligenceParamsSchema.parse(req.params);
    const payload = candidateIntelligenceRegenerateSchema.parse(req.body || {});
    const data = await regenerateCandidateIntelligence(req.user, {
      candidateId: params.candidateId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 202, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateMatch(req, res, next) {
  try {
    const payload = candidateMatchRequestSchema.parse(req.body);
    const data = await getCandidateMatchIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postBatchCandidateMatch(req, res, next) {
  try {
    const payload = batchCandidateMatchRequestSchema.parse(req.body);
    const data = await getBatchCandidateMatchIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobIntelligence(req, res, next) {
  try {
    const payload = jobIntelligenceRequestSchema.parse(req.body);
    const data = await getJobIntelligence(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateJobMatchIntelligence(req, res, next) {
  try {
    const params = candidateJobMatchParamsSchema.parse(req.params);
    const data = await getCandidateJobMatch(req.user, params, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateJobMatchIntelligenceStatus(req, res, next) {
  try {
    const params = candidateJobMatchParamsSchema.parse(req.params);
    const data = await getCandidateJobMatchStatus(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateJobMatchIntelligenceRegenerate(req, res, next) {
  try {
    const params = candidateJobMatchParamsSchema.parse(req.params);
    const payload = candidateJobMatchRegenerateSchema.parse(req.body || {});
    const data = await regenerateCandidateJobMatch(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 202, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateJobMatchOverrideList(req, res, next) {
  try {
    const params = candidateJobMatchParamsSchema.parse(req.params);
    const data = await listCandidateJobMatchOverrides(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateJobMatchOverride(req, res, next) {
  try {
    const params = candidateJobMatchParamsSchema.parse(req.params);
    const payload = candidateJobMatchOverrideSchema.parse(req.body || {});
    const data = await createRecruiterMatchOverride(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateRankingSnapshot(req, res, next) {
  try {
    const params = candidateRankingParamsSchema.parse(req.params);
    const query = candidateRankingQuerySchema.parse(req.query || {});
    const data = await getCandidateRanking(req.user, {
      ...params,
      ...query,
    });
    return sendSuccess(res, 200, data.snapshot, data.meta ? { pagination: data.meta } : undefined);
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateRankingList(req, res, next) {
  try {
    const params = candidateRankingParamsSchema.parse(req.params);
    const query = candidateRankingQuerySchema.parse(req.query || {});
    const data = await getCandidateRanking(req.user, {
      ...params,
      ...query,
    });
    return sendSuccess(res, 200, data.entries, {
      snapshot: data.snapshot,
      pagination: data.meta,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCandidateRankingSnapshotStatus(req, res, next) {
  try {
    const params = candidateRankingParamsSchema.parse(req.params);
    const data = await getCandidateRankingStatus(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateRankingGenerate(req, res, next) {
  try {
    const params = candidateRankingParamsSchema.parse(req.params);
    const payload = candidateRankingGenerateSchema.parse(req.body || {});
    const data = await generateCandidateRanking(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 202, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateRankingRefresh(req, res, next) {
  try {
    const params = candidateRankingParamsSchema.parse(req.params);
    const payload = candidateRankingGenerateSchema.parse(req.body || {});
    const data = await refreshCandidateRanking(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 202, data);
  } catch (error) {
    return next(error);
  }
}

export async function getMatchScoringProfileList(req, res, next) {
  try {
    const data = await listMatchScoringProfiles(req.user);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postMatchScoringProfile(req, res, next) {
  try {
    const payload = matchScoringProfileCreateSchema.parse(req.body || {});
    const data = await createMatchScoringProfile(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function getMatchScoringProfileDetail(req, res, next) {
  try {
    const params = matchScoringProfileParamsSchema.parse(req.params);
    const data = await getMatchScoringProfile(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postMatchScoringProfileVersion(req, res, next) {
  try {
    const params = matchScoringProfileParamsSchema.parse(req.params);
    const payload = matchScoringProfileVersionCreateSchema.parse(req.body || {});
    const data = await createMatchScoringProfileVersion(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function postMatchScoringProfileActivate(req, res, next) {
  try {
    const params = matchScoringProfileParamsSchema.parse(req.params);
    const payload = matchScoringProfileActivateSchema.parse(req.body || {});
    const data = await activateMatchScoringProfile(req.user, {
      ...params,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionIntelligence(req, res, next) {
  try {
    const params = jobDescriptionParamsSchema.parse(req.params);
    const payload = jobDescriptionRequestSchema.parse({
      jobId: params.jobId,
      kind: req.query.kind,
      includeStale: req.query.includeStale === 'true',
    });
    const data = await getJobDescription(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionIntelligenceStatus(req, res, next) {
  try {
    const params = jobDescriptionParamsSchema.parse(req.params);
    const data = await getJobDescriptionStatus(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionIntelligenceRegenerate(req, res, next) {
  try {
    const params = jobDescriptionParamsSchema.parse(req.params);
    const payload = jobDescriptionRegenerateSchema.parse(req.body || {});
    const data = await regenerateJobDescription(req.user, {
      jobId: params.jobId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 202, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionDraftList(req, res, next) {
  try {
    const params = jobDescriptionParamsSchema.parse(req.params);
    const data = await listJobDescriptionDrafts(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionDraftDetail(req, res, next) {
  try {
    const params = jobDescriptionDraftParamsSchema.parse(req.params);
    const data = await getJobDescriptionDraft(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionDraft(req, res, next) {
  try {
    const payload = jobDescriptionDraftCreateSchema.parse(req.body);
    const data = await createJobDescriptionDraft(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function patchJobDescriptionDraft(req, res, next) {
  try {
    const params = jobDescriptionDraftParamsSchema.parse(req.params);
    const payload = jobDescriptionDraftUpdateSchema.parse(req.body || {});
    const data = await updateJobDescriptionDraft(req.user, {
      draftId: params.draftId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionDraftApply(req, res, next) {
  try {
    const params = jobDescriptionDraftParamsSchema.parse(req.params);
    const payload = jobDescriptionDraftApplySchema.parse(req.body || {});
    const data = await applyJobDescriptionDraft(req.user, {
      draftId: params.draftId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionTemplates(req, res, next) {
  try {
    const data = await listJobDescriptionTemplates(req.user);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionTemplate(req, res, next) {
  try {
    const payload = jobDescriptionTemplateCreateSchema.parse(req.body);
    const data = await createJobDescriptionTemplate(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionTemplateDetail(req, res, next) {
  try {
    const params = jobDescriptionTemplateParamsSchema.parse(req.params);
    const data = await getJobDescriptionTemplate(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionTemplateVersion(req, res, next) {
  try {
    const params = jobDescriptionTemplateParamsSchema.parse(req.params);
    const payload = jobDescriptionTemplateVersionCreateSchema.parse(req.body);
    const data = await createJobDescriptionTemplateVersion(req.user, {
      templateId: params.templateId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobDescriptionTemplateActivate(req, res, next) {
  try {
    const params = jobDescriptionTemplateParamsSchema.parse(req.params);
    const payload = jobDescriptionTemplateActivateSchema.parse(req.body || {});
    const data = await activateJobDescriptionTemplate(req.user, {
      templateId: params.templateId,
      ...payload,
    }, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getJobDescriptionJobHistory(req, res, next) {
  try {
    const params = jobDescriptionParamsSchema.parse(req.params);
    const data = await getJobDescriptionHistory(req.user, params);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postInterviewIntelligence(req, res, next) {
  try {
    const payload = interviewIntelligenceRequestSchema.parse(req.body);
    const data = await getInterviewIntelligence(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postTalentSearchParse(req, res, next) {
  try {
    const payload = naturalLanguageTalentSearchSchema.parse(req.body);
    const legacy = await parseTalentSearchQuery(req.user, payload);
    let parsedQuery = null;
    let intent = null;

    try {
      [parsedQuery, intent] = await Promise.all([
        getSemanticSearchParse(req.user, payload),
        getSemanticSearchIntent(req.user, payload),
      ]);
    } catch {
      parsedQuery = null;
      intent = null;
    }

    const data = {
      ...legacy,
      searchMode: parsedQuery?.mode || null,
      parsedQuery,
      searchIntent: intent || null,
    };
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSemanticSearchParse(req, res, next) {
  try {
    const payload = semanticSearchParseRequestSchema.parse(req.body || {});
    const data = await getSemanticSearchParse(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSemanticSearchIntent(req, res, next) {
  try {
    const payload = semanticSearchIntentRequestSchema.parse(req.body || {});
    const data = await getSemanticSearchIntent(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSemanticSearch(req, res, next) {
  try {
    const payload = semanticSearchRequestSchema.parse(req.body || {});
    const data = await searchSemanticCandidates(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSemanticSearchPreview(req, res, next) {
  try {
    const payload = semanticSearchRequestSchema.parse(req.body || {});
    const data = await previewSemanticSearch(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSemanticSearchSuggestions(req, res, next) {
  try {
    const payload = semanticSearchSuggestionRequestSchema.parse(req.body || {});
    const data = await getSemanticSearchSuggestions(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getSemanticSearchHistory(req, res, next) {
  try {
    const query = semanticSearchHistoryQuerySchema.parse(req.query || {});
    const data = await listSemanticSearchHistory(req.user, query);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getSemanticSearchHistoryItem(req, res, next) {
  try {
    const params = semanticSearchHistoryParamsSchema.parse(req.params);
    const data = await getSemanticSearchHistoryDetail(req.user, params.queryId);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSimilarCandidateSearch(req, res, next) {
  try {
    const payload = semanticSearchRequestSchema.parse(req.body || {});
    const data = await searchSimilarCandidateProfiles(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSimilarJobSearch(req, res, next) {
  try {
    const payload = semanticSearchRequestSchema.parse(req.body || {});
    const data = await searchSimilarJobProfiles(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getSavedSemanticSearches(req, res, next) {
  try {
    const data = await listSavedCandidateSearches(req.user);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postSavedSemanticSearch(req, res, next) {
  try {
    const payload = savedCandidateSearchCreateSchema.parse(req.body || {});
    const data = await createSavedCandidateSearch(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}

export async function getSavedSemanticSearch(req, res, next) {
  try {
    const params = savedCandidateSearchParamsSchema.parse(req.params);
    const data = await getSavedCandidateSearch(req.user, params.savedSearchId);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function patchSavedSemanticSearch(req, res, next) {
  try {
    const params = savedCandidateSearchParamsSchema.parse(req.params);
    const payload = savedCandidateSearchUpdateSchema.parse(req.body || {});
    const data = await updateSavedCandidateSearch(req.user, params.savedSearchId, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postExecuteSavedSemanticSearch(req, res, next) {
  try {
    const params = savedCandidateSearchParamsSchema.parse(req.params);
    const data = await executeSavedCandidateSearch(req.user, params.savedSearchId, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postArchiveSavedSemanticSearch(req, res, next) {
  try {
    const params = savedCandidateSearchParamsSchema.parse(req.params);
    const data = await archiveSavedCandidateSearch(req.user, params.savedSearchId, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postAnalyticsInsight(req, res, next) {
  try {
    const payload = analyticsInsightRequestSchema.parse(req.body);
    const data = await getAnalyticsInsight(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getIntelligenceGovernance(req, res, next) {
  try {
    const filters = intelligenceGovernanceQuerySchema.partial().parse(req.query);
    const data = await getIntelligenceGovernanceDashboard(req.user, filters);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postIntelligenceFeedback(req, res, next) {
  try {
    const payload = intelligenceFeedbackSchema.parse(req.body);
    const data = await recordIntelligenceFeedback(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}
