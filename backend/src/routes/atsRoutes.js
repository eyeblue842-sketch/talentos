import { Router } from 'express';
import {
  applyForJob,
  getPipeline,
  movePipelineStage,
  planInterview,
  createAtsNote,
  getCandidateApplicationList,
} from '../controllers/atsController.js';
import { auth } from '../middleware/auth.js';

export const atsRouter = Router();

atsRouter.post('/apply', auth(['CANDIDATE']), applyForJob);
atsRouter.get('/pipeline', auth(['RECRUITER']), getPipeline);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), planInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(), createAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
