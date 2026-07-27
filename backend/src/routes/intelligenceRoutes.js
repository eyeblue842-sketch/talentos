import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getCandidateProfileIntelligence,
  getCandidateProfileIntelligenceStatus,
  getIntelligenceGovernance,
  getIntelligenceHealth,
  postAnalyticsInsight,
  postBatchCandidateMatch,
  postCandidateMatch,
  postCandidateProfileIntelligenceRegenerate,
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
intelligenceRouter.post('/feedback', postIntelligenceFeedback);
intelligenceRouter.post('/candidates/:candidateId/regenerate', postCandidateProfileIntelligenceRegenerate);
intelligenceRouter.post('/resume', postResumeIntelligence);
intelligenceRouter.post('/match', postCandidateMatch);
intelligenceRouter.post('/match/batch', postBatchCandidateMatch);
intelligenceRouter.post('/job', postJobIntelligence);
intelligenceRouter.post('/interview', postInterviewIntelligence);
intelligenceRouter.post('/search/parse', postTalentSearchParse);
intelligenceRouter.post('/analytics/insight', postAnalyticsInsight);
