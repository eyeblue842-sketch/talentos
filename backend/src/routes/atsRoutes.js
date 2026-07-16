import { Router } from 'express';
import {
  applyForJob,
  getPipelineApplication,
  getPipeline,
  movePipelineStage,
  planInterview,
  cancelPlannedInterview,
  createAtsNote,
  editAtsNote,
  removeAtsNote,
  getCandidateApplicationList,
} from '../controllers/atsController.js';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { applyToJobSchema, atsInterviewCancelSchema, atsInterviewSchema, atsNoteSchema, atsNoteUpdateSchema, atsStageUpdateSchema } from '@careeriz/shared';

export const atsRouter = Router();

atsRouter.post('/apply', auth(['CANDIDATE']), validateSchema(applyToJobSchema), applyForJob);
atsRouter.get('/pipeline', auth(['RECRUITER']), getPipeline);
atsRouter.get('/pipeline/:applicationId', auth(['RECRUITER']), getPipelineApplication);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), validateSchema(atsStageUpdateSchema), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), validateSchema(atsInterviewSchema), planInterview);
atsRouter.patch('/pipeline/:applicationId/interview/cancel', auth(['RECRUITER']), validateSchema(atsInterviewCancelSchema), cancelPlannedInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(['RECRUITER']), validateSchema(atsNoteSchema), createAtsNote);
atsRouter.patch('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), validateSchema(atsNoteUpdateSchema), editAtsNote);
atsRouter.delete('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), removeAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
