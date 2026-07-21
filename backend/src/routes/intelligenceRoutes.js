import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getIntelligenceGovernance,
  getIntelligenceHealth,
  postAnalyticsInsight,
  postBatchCandidateMatch,
  postCandidateMatch,
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
intelligenceRouter.post('/feedback', postIntelligenceFeedback);
intelligenceRouter.post('/resume', postResumeIntelligence);
intelligenceRouter.post('/match', postCandidateMatch);
intelligenceRouter.post('/match/batch', postBatchCandidateMatch);
intelligenceRouter.post('/job', postJobIntelligence);
intelligenceRouter.post('/interview', postInterviewIntelligence);
intelligenceRouter.post('/search/parse', postTalentSearchParse);
intelligenceRouter.post('/analytics/insight', postAnalyticsInsight);
