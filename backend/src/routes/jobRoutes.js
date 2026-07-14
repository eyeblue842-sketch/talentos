import { Router } from 'express';
import {
  createRecruiterJob,
  getRecruiterJobs,
  editRecruiterJob,
  removeRecruiterJob,
  getPublicJobs,
} from '../controllers/jobController.js';
import { auth } from '../middleware/auth.js';

export const jobRouter = Router();

jobRouter.get('/public', getPublicJobs);
jobRouter.get('/', auth(['RECRUITER']), getRecruiterJobs);
jobRouter.post('/', auth(['RECRUITER']), createRecruiterJob);
jobRouter.patch('/:jobId', auth(['RECRUITER']), editRecruiterJob);
jobRouter.delete('/:jobId', auth(['RECRUITER']), removeRecruiterJob);
