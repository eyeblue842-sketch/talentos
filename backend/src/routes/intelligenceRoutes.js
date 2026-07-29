import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getCandidateProfileIntelligence,
  getCandidateProfileIntelligenceStatus,
  getSavedSemanticSearch,
  getSavedSemanticSearches,
  getSemanticSearchHistory,
  getSemanticSearchHistoryItem,
  getCandidateJobMatchIntelligence,
  getCandidateJobMatchIntelligenceStatus,
  getCandidateJobMatchOverrideList,
  getCandidateRankingList,
  getCandidateRankingSnapshot,
  getCandidateRankingSnapshotStatus,
  getIntelligenceGovernance,
  getIntelligenceHealth,
  getJobDescriptionDraftDetail,
  getJobDescriptionDraftList,
  getJobDescriptionIntelligence,
  getJobDescriptionIntelligenceStatus,
  getJobDescriptionJobHistory,
  getJobDescriptionTemplateDetail,
  getJobDescriptionTemplates,
  getMatchScoringProfileDetail,
  getMatchScoringProfileList,
  postAnalyticsInsight,
  postCandidateJobMatchOverride,
  postCandidateRankingGenerate,
  postCandidateRankingRefresh,
  postBatchCandidateMatch,
  postCandidateJobMatchIntelligenceRegenerate,
  postCandidateMatch,
  postMatchScoringProfile,
  postMatchScoringProfileActivate,
  postMatchScoringProfileVersion,
  postCandidateProfileIntelligenceRegenerate,
  patchJobDescriptionDraft,
  patchSavedSemanticSearch,
  postArchiveSavedSemanticSearch,
  postJobDescriptionDraft,
  postJobDescriptionDraftApply,
  postJobDescriptionIntelligenceRegenerate,
  postJobDescriptionTemplate,
  postJobDescriptionTemplateActivate,
  postJobDescriptionTemplateVersion,
  postIntelligenceFeedback,
  postInterviewIntelligence,
  postJobIntelligence,
  postResumeIntelligence,
  postSavedSemanticSearch,
  postSemanticSearch,
  postSemanticSearchSuggestions,
  postSemanticSearchIntent,
  postSemanticSearchPreview,
  postSimilarCandidateSearch,
  postSimilarJobSearch,
  postExecuteSavedSemanticSearch,
  postTalentSearchParse,
} from '../controllers/intelligenceController.js';

export const intelligenceRouter = Router();

intelligenceRouter.use(auth(['RECRUITER', 'ADMIN']));
intelligenceRouter.get('/health', getIntelligenceHealth);
intelligenceRouter.get('/governance', getIntelligenceGovernance);
intelligenceRouter.get('/candidates/:candidateId', getCandidateProfileIntelligence);
intelligenceRouter.get('/candidates/:candidateId/status', getCandidateProfileIntelligenceStatus);
intelligenceRouter.get('/jobs/:jobId/candidates/:candidateId/match', getCandidateJobMatchIntelligence);
intelligenceRouter.get('/jobs/:jobId/candidates/:candidateId/match/status', getCandidateJobMatchIntelligenceStatus);
intelligenceRouter.get('/jobs/:jobId/candidates/:candidateId/match/overrides', getCandidateJobMatchOverrideList);
intelligenceRouter.get('/jobs/:jobId/ranking/status', getCandidateRankingSnapshotStatus);
intelligenceRouter.get('/jobs/:jobId/ranking', getCandidateRankingList);
intelligenceRouter.get('/jobs/:jobId/ranking/snapshot', getCandidateRankingSnapshot);
intelligenceRouter.get('/jobs/:jobId', getJobDescriptionIntelligence);
intelligenceRouter.get('/jobs/:jobId/status', getJobDescriptionIntelligenceStatus);
intelligenceRouter.get('/jobs/:jobId/drafts', getJobDescriptionDraftList);
intelligenceRouter.get('/jobs/:jobId/history', getJobDescriptionJobHistory);
intelligenceRouter.get('/job-description-drafts/:draftId', getJobDescriptionDraftDetail);
intelligenceRouter.get('/job-description-templates', getJobDescriptionTemplates);
intelligenceRouter.get('/job-description-templates/:templateId', getJobDescriptionTemplateDetail);
intelligenceRouter.get('/match-scoring-profiles', getMatchScoringProfileList);
intelligenceRouter.get('/match-scoring-profiles/:profileId', getMatchScoringProfileDetail);
intelligenceRouter.get('/search/history', getSemanticSearchHistory);
intelligenceRouter.get('/search/history/:queryId', getSemanticSearchHistoryItem);
intelligenceRouter.get('/saved-searches', getSavedSemanticSearches);
intelligenceRouter.get('/saved-searches/:savedSearchId', getSavedSemanticSearch);
intelligenceRouter.post('/feedback', postIntelligenceFeedback);
intelligenceRouter.post('/candidates/:candidateId/regenerate', postCandidateProfileIntelligenceRegenerate);
intelligenceRouter.post('/jobs/:jobId/candidates/:candidateId/match/override', postCandidateJobMatchOverride);
intelligenceRouter.post('/jobs/:jobId/candidates/:candidateId/match/regenerate', postCandidateJobMatchIntelligenceRegenerate);
intelligenceRouter.post('/jobs/:jobId/ranking/generate', postCandidateRankingGenerate);
intelligenceRouter.post('/jobs/:jobId/ranking/refresh', postCandidateRankingRefresh);
intelligenceRouter.post('/jobs/:jobId/regenerate', postJobDescriptionIntelligenceRegenerate);
intelligenceRouter.post('/job-description-drafts', postJobDescriptionDraft);
intelligenceRouter.patch('/job-description-drafts/:draftId', patchJobDescriptionDraft);
intelligenceRouter.post('/job-description-drafts/:draftId/apply', postJobDescriptionDraftApply);
intelligenceRouter.post('/job-description-templates', postJobDescriptionTemplate);
intelligenceRouter.post('/job-description-templates/:templateId/versions', postJobDescriptionTemplateVersion);
intelligenceRouter.post('/job-description-templates/:templateId/activate', postJobDescriptionTemplateActivate);
intelligenceRouter.post('/match-scoring-profiles', postMatchScoringProfile);
intelligenceRouter.post('/match-scoring-profiles/:profileId/versions', postMatchScoringProfileVersion);
intelligenceRouter.post('/match-scoring-profiles/:profileId/activate', postMatchScoringProfileActivate);
intelligenceRouter.post('/resume', postResumeIntelligence);
intelligenceRouter.post('/match', postCandidateMatch);
intelligenceRouter.post('/match/batch', postBatchCandidateMatch);
intelligenceRouter.post('/job', postJobIntelligence);
intelligenceRouter.post('/interview', postInterviewIntelligence);
intelligenceRouter.post('/search/parse', postTalentSearchParse);
intelligenceRouter.post('/search', postSemanticSearch);
intelligenceRouter.post('/search/preview', postSemanticSearchPreview);
intelligenceRouter.post('/search/intent', postSemanticSearchIntent);
intelligenceRouter.post('/search/suggestions', postSemanticSearchSuggestions);
intelligenceRouter.post('/search/similar-candidate', postSimilarCandidateSearch);
intelligenceRouter.post('/search/similar-job', postSimilarJobSearch);
intelligenceRouter.post('/saved-searches', postSavedSemanticSearch);
intelligenceRouter.patch('/saved-searches/:savedSearchId', patchSavedSemanticSearch);
intelligenceRouter.post('/saved-searches/:savedSearchId/execute', postExecuteSavedSemanticSearch);
intelligenceRouter.post('/saved-searches/:savedSearchId/archive', postArchiveSavedSemanticSearch);
intelligenceRouter.post('/analytics/insight', postAnalyticsInsight);
