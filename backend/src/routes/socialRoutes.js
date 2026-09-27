import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  startLinkedInConnect,
  linkedInOAuthCallback,
  getLinkedInStatusController,
  disconnectLinkedInController,
  postJobToLinkedInController,
} from '../controllers/socialController.js';

export const socialRouter = Router();

// The OAuth callback is a public browser redirect (no bearer auth).
socialRouter.get('/linkedin/callback', linkedInOAuthCallback);

socialRouter.get('/linkedin/status', auth(['RECRUITER']), getLinkedInStatusController);
socialRouter.post('/linkedin/connect', auth(['RECRUITER']), startLinkedInConnect);
socialRouter.delete('/linkedin', auth(['RECRUITER']), disconnectLinkedInController);
socialRouter.post('/linkedin/jobs/:jobId/post', auth(['RECRUITER']), postJobToLinkedInController);
