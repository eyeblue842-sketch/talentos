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
import { validateSchema } from '../middleware/schema.js';
import { applyToJobSchema, atsInterviewSchema, atsNoteSchema, atsStageUpdateSchema } from '@careeriz/shared';

export const atsRouter = Router();

atsRouter.post('/apply', auth(['CANDIDATE']), validateSchema(applyToJobSchema), applyForJob);
atsRouter.get('/pipeline', auth(['RECRUITER']), getPipeline);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), validateSchema(atsStageUpdateSchema), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), validateSchema(atsInterviewSchema), planInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(['RECRUITER']), validateSchema(atsNoteSchema), createAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
