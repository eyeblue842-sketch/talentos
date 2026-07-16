import { Router } from 'express';
import {
  createRecruiterJob,
  getRecruiterJobDetail,
  getRecruiterJobs,
  editRecruiterJob,
  changeRecruiterJobStatus,
  removeRecruiterJob,
  getPublicJobs,
} from '../controllers/jobController.js';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { createJobSchema, updateJobSchema, updateJobStatusSchema } from '@careeriz/shared';

export const jobRouter = Router();

jobRouter.get('/public', getPublicJobs);
jobRouter.get('/', auth(['RECRUITER']), getRecruiterJobs);
jobRouter.post('/', auth(['RECRUITER']), validateSchema(createJobSchema), createRecruiterJob);
jobRouter.get('/:jobId', auth(['RECRUITER']), getRecruiterJobDetail);
jobRouter.patch('/:jobId', auth(['RECRUITER']), validateSchema(updateJobSchema), editRecruiterJob);
jobRouter.post('/:jobId/status', auth(['RECRUITER']), validateSchema(updateJobStatusSchema), changeRecruiterJobStatus);
jobRouter.delete('/:jobId', auth(['RECRUITER']), removeRecruiterJob);
