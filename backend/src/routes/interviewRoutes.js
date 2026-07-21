import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  interviewFeedbackCreateSchema,
  interviewRoundDecisionSchema,
  interviewRoundDuplicateSchema,
  interviewPlanCreateSchema,
  interviewRoundCreateSchema,
  interviewRoundUpdateSchema,
} from '@careeriz/shared';
import {
  createFeedback,
  createPlan,
  createRound,
  decideRound,
  downloadRoundCalendar,
  duplicateRound,
  getFeedback,
  listPlans,
  updateRound,
} from '../controllers/interviewController.js';

export const interviewRouter = Router();

interviewRouter.post('/plans', auth(['RECRUITER']), validateSchema(interviewPlanCreateSchema), createPlan);
interviewRouter.get('/plans/application/:applicationId', auth(['RECRUITER']), listPlans);
interviewRouter.post('/plans/:interviewProcessId/rounds', auth(['RECRUITER']), validateSchema(interviewRoundCreateSchema), createRound);
interviewRouter.patch('/rounds/:roundId', auth(['RECRUITER']), validateSchema(interviewRoundUpdateSchema), updateRound);
interviewRouter.post('/rounds/:roundId/duplicate', auth(['RECRUITER']), validateSchema(interviewRoundDuplicateSchema), duplicateRound);
interviewRouter.get('/rounds/:roundId/feedback', auth(['RECRUITER']), getFeedback);
interviewRouter.post('/rounds/:roundId/feedback', auth(['RECRUITER']), validateSchema(interviewFeedbackCreateSchema), createFeedback);
interviewRouter.post('/rounds/:roundId/decision', auth(['RECRUITER']), validateSchema(interviewRoundDecisionSchema), decideRound);
interviewRouter.get('/rounds/:roundId/calendar.ics', auth(['RECRUITER']), downloadRoundCalendar);
