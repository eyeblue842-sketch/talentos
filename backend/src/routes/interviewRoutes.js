import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  interviewFeedbackCreateSchema,
  interviewPlanCreateSchema,
  interviewRoundCreateSchema,
} from '@careeriz/shared';
import {
  createFeedback,
  createPlan,
  createRound,
  getFeedback,
  listPlans,
} from '../controllers/interviewController.js';

export const interviewRouter = Router();

interviewRouter.post('/plans', auth(['RECRUITER']), validateSchema(interviewPlanCreateSchema), createPlan);
interviewRouter.get('/plans/application/:applicationId', auth(['RECRUITER']), listPlans);
interviewRouter.post('/plans/:interviewProcessId/rounds', auth(['RECRUITER']), validateSchema(interviewRoundCreateSchema), createRound);
interviewRouter.get('/rounds/:roundId/feedback', auth(['RECRUITER']), getFeedback);
interviewRouter.post('/rounds/:roundId/feedback', auth(['RECRUITER']), validateSchema(interviewFeedbackCreateSchema), createFeedback);
