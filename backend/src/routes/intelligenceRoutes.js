import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getCandidateProfileIntelligence,
  getCandidateProfileIntelligenceStatus,
  getIntelligenceGovernance,
  getIntelligenceHealth,
  getJobDescriptionDraftDetail,
  getJobDescriptionDraftList,
  getJobDescriptionIntelligence,
  getJobDescriptionIntelligenceStatus,
  getJobDescriptionJobHistory,
  getJobDescriptionTemplateDetail,
  getJobDescriptionTemplates,
  postAnalyticsInsight,
  postBatchCandidateMatch,
  postCandidateMatch,
  postCandidateProfileIntelligenceRegenerate,
  patchJobDescriptionDraft,
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
  postTalentSearchParse,
} from '../controllers/intelligenceController.js';

export const intelligenceRouter = Router();

intelligenceRouter.use(auth(['RECRUITER', 'ADMIN']));
intelligenceRouter.get('/health', getIntelligenceHealth);
intelligenceRouter.get('/governance', getIntelligenceGovernance);
intelligenceRouter.get('/candidates/:candidateId', getCandidateProfileIntelligence);
intelligenceRouter.get('/candidates/:candidateId/status', getCandidateProfileIntelligenceStatus);
intelligenceRouter.get('/jobs/:jobId', getJobDescriptionIntelligence);
intelligenceRouter.get('/jobs/:jobId/status', getJobDescriptionIntelligenceStatus);
intelligenceRouter.get('/jobs/:jobId/drafts', getJobDescriptionDraftList);
intelligenceRouter.get('/jobs/:jobId/history', getJobDescriptionJobHistory);
intelligenceRouter.get('/job-description-drafts/:draftId', getJobDescriptionDraftDetail);
intelligenceRouter.get('/job-description-templates', getJobDescriptionTemplates);
intelligenceRouter.get('/job-description-templates/:templateId', getJobDescriptionTemplateDetail);
intelligenceRouter.post('/feedback', postIntelligenceFeedback);
intelligenceRouter.post('/candidates/:candidateId/regenerate', postCandidateProfileIntelligenceRegenerate);
intelligenceRouter.post('/jobs/:jobId/regenerate', postJobDescriptionIntelligenceRegenerate);
intelligenceRouter.post('/job-description-drafts', postJobDescriptionDraft);
intelligenceRouter.patch('/job-description-drafts/:draftId', patchJobDescriptionDraft);
intelligenceRouter.post('/job-description-drafts/:draftId/apply', postJobDescriptionDraftApply);
intelligenceRouter.post('/job-description-templates', postJobDescriptionTemplate);
intelligenceRouter.post('/job-description-templates/:templateId/versions', postJobDescriptionTemplateVersion);
intelligenceRouter.post('/job-description-templates/:templateId/activate', postJobDescriptionTemplateActivate);
intelligenceRouter.post('/resume', postResumeIntelligence);
intelligenceRouter.post('/match', postCandidateMatch);
intelligenceRouter.post('/match/batch', postBatchCandidateMatch);
intelligenceRouter.post('/job', postJobIntelligence);
intelligenceRouter.post('/interview', postInterviewIntelligence);
intelligenceRouter.post('/search/parse', postTalentSearchParse);
intelligenceRouter.post('/analytics/insight', postAnalyticsInsight);
