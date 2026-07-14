import { Router } from 'express';
import { recruiterDashboard, candidateDashboard } from '../controllers/dashboardController.js';
import { auth } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/recruiter', auth(['RECRUITER']), recruiterDashboard);
dashboardRouter.get('/candidate', auth(['CANDIDATE']), candidateDashboard);
