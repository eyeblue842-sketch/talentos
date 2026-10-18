import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  postApplicationScreeningCall,
  getApplicationScreeningCalls,
  getScreeningCallsList,
  getScreeningCallById,
  postVapiScreeningWebhook,
  postPlivoScreeningWebhook,
} from '../controllers/aiRecruiterController.js';

// AI voice recruiter routes. Recruiter-only (RECRUITER_ADMIN satisfies RECRUITER
// via roleSatisfies). The whole feature returns 404 while AI_SCREENING_ENABLED
// is off (enforced in the controller), so mounting this is a no-op by default.
export const aiRecruiterRouter = Router();

aiRecruiterRouter.post('/applications/:applicationId/screening-calls', auth(['RECRUITER']), postApplicationScreeningCall);
aiRecruiterRouter.get('/applications/:applicationId/screening-calls', auth(['RECRUITER']), getApplicationScreeningCalls);
aiRecruiterRouter.get('/screening-calls', auth(['RECRUITER']), getScreeningCallsList);
aiRecruiterRouter.get('/screening-calls/:id', auth(['RECRUITER']), getScreeningCallById);

// Unauthenticated provider webhooks (shared-secret verified in the controller).
aiRecruiterRouter.post('/webhooks/vapi', postVapiScreeningWebhook);
aiRecruiterRouter.post('/webhooks/plivo', postPlivoScreeningWebhook);
