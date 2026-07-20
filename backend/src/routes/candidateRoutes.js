import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  candidateJobViewCreateSchema,
  candidateRecentJobListQuerySchema,
  candidateNotificationReadSchema,
  candidateProfileUpdateSchema,
  candidateSavedJobListQuerySchema,
  candidateSettingsUpdateSchema,
  notificationPageQuerySchema,
  savedJobCreateSchema,
} from '@careeriz/shared';
import {
  createCandidateJobView,
  createSavedJob,
  deleteSavedJob,
  deleteCandidateRecentJobs,
  getCandidateHomeDashboard,
  getCandidateNotificationList,
  getCandidatePreferenceSettings,
  getCandidateProfile,
  getCandidateRecentJobs,
  getCandidateSavedJobs,
  getCandidateSuggestedJobs,
  markCandidateNotification,
  markCandidateNotifications,
  patchCandidateProfile,
  patchCandidateSettings,
} from '../controllers/candidateController.js';

export const candidateRouter = Router();

candidateRouter.use(auth(['CANDIDATE']));
candidateRouter.get('/dashboard', getCandidateHomeDashboard);
candidateRouter.get('/profile', getCandidateProfile);
candidateRouter.patch('/profile', validateSchema(candidateProfileUpdateSchema), patchCandidateProfile);
candidateRouter.get('/settings', getCandidatePreferenceSettings);
candidateRouter.patch('/settings', validateSchema(candidateSettingsUpdateSchema), patchCandidateSettings);
candidateRouter.get('/saved-jobs', validateSchema(candidateSavedJobListQuerySchema.partial(), 'query'), getCandidateSavedJobs);
candidateRouter.post('/saved-jobs', validateSchema(savedJobCreateSchema), createSavedJob);
candidateRouter.delete('/saved-jobs/:jobId', deleteSavedJob);
candidateRouter.get('/recent-jobs', validateSchema(candidateRecentJobListQuerySchema.partial(), 'query'), getCandidateRecentJobs);
candidateRouter.post('/recent-jobs', validateSchema(candidateJobViewCreateSchema), createCandidateJobView);
candidateRouter.delete('/recent-jobs', deleteCandidateRecentJobs);
candidateRouter.get('/notifications', validateSchema(notificationPageQuerySchema, 'query'), getCandidateNotificationList);
candidateRouter.post('/notifications/read', validateSchema(candidateNotificationReadSchema), markCandidateNotification);
candidateRouter.post('/notifications/read-all', markCandidateNotifications);
candidateRouter.get('/recommendations', getCandidateSuggestedJobs);
