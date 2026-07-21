import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  interviewAvailabilitySchema,
  interviewFeedbackCreateSchema,
  interviewRescheduleRequestCreateSchema,
  interviewRescheduleRequestReviewSchema,
  interviewRescheduleRequestWithdrawSchema,
  interviewRoundDecisionSchema,
  interviewRoundDuplicateSchema,
  interviewPlanCreateSchema,
  interviewRoundCreateSchema,
  interviewRoundUpdateSchema,
} from '@careeriz/shared';
import {
  createFeedback,
  createInterviewerRescheduleRequest,
  createPlan,
  createRound,
  decideRound,
  downloadCandidateRoundCalendar,
  downloadRoundCalendar,
  duplicateRound,
  getFeedback,
  getInterviewMeeting,
  listAssignedInterviewMeetings,
  listInterviewMeetings,
  listPlans,
  previewInterviewAvailability,
  reviewRescheduleRequest,
  updateRound,
  withdrawInterviewerRescheduleRequest,
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
interviewRouter.get('/meetings', auth(['RECRUITER']), listInterviewMeetings);
interviewRouter.get('/assigned', auth(['RECRUITER']), listAssignedInterviewMeetings);
interviewRouter.post('/availability', auth(['RECRUITER']), validateSchema(interviewAvailabilitySchema), previewInterviewAvailability);
interviewRouter.get('/rounds/:roundId/meeting', auth(['RECRUITER']), getInterviewMeeting);
interviewRouter.get('/rounds/:roundId/calendar.ics', auth(['RECRUITER']), downloadRoundCalendar);
interviewRouter.post('/rounds/:roundId/reschedule-request', auth(['RECRUITER']), validateSchema(interviewRescheduleRequestCreateSchema), createInterviewerRescheduleRequest);
interviewRouter.post('/reschedule-requests/:requestId/review', auth(['RECRUITER']), validateSchema(interviewRescheduleRequestReviewSchema), reviewRescheduleRequest);
interviewRouter.post('/reschedule-requests/withdraw', auth(['RECRUITER']), validateSchema(interviewRescheduleRequestWithdrawSchema), withdrawInterviewerRescheduleRequest);
interviewRouter.get('/candidate/rounds/:roundId/calendar.ics', auth(['CANDIDATE']), downloadCandidateRoundCalendar);
