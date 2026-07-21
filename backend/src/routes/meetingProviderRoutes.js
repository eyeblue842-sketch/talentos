import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  disconnectMeetingProviderController,
  getMeetingProviders,
  handleMeetingProviderCallbackController,
  startMeetingProviderConnect,
  validateMeetingProvider,
} from '../controllers/meetingProviderController.js';

export const meetingProviderRouter = Router();

meetingProviderRouter.get('/callback/:provider', handleMeetingProviderCallbackController);
meetingProviderRouter.get('/admin/providers', auth(['RECRUITER', 'ADMIN']), getMeetingProviders);
meetingProviderRouter.post('/admin/providers/:provider/connect', auth(['RECRUITER', 'ADMIN']), startMeetingProviderConnect);
meetingProviderRouter.post('/admin/providers/:provider/validate', auth(['RECRUITER', 'ADMIN']), validateMeetingProvider);
meetingProviderRouter.delete('/admin/providers/:provider', auth(['RECRUITER', 'ADMIN']), disconnectMeetingProviderController);
