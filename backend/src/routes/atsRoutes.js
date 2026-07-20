import { Router } from 'express';
import {
  applyForJob,
  addResumeSearchCandidatesToAts,
  getPipelineApplication,
  getPipeline,
  movePipelineStage,
  planInterview,
  cancelPlannedInterview,
  createAtsNote,
  editAtsNote,
  removeAtsNote,
  emailResumeSearchCandidates,
  getCandidateApplicationList,
  shortlistResumeSearchCandidates,
  tagResumeSearchCandidates,
} from '../controllers/atsController.js';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import {
  applyToJobSchema,
  atsInterviewCancelSchema,
  atsInterviewSchema,
  atsNoteSchema,
  atsNoteUpdateSchema,
  atsStageUpdateSchema,
  recruiterResumeEmailActionSchema,
  recruiterResumeTagActionSchema,
  recruiterResumeWorkflowActionSchema,
} from '@careeriz/shared';

export const atsRouter = Router();

atsRouter.post('/apply', auth(['CANDIDATE']), validateSchema(applyToJobSchema), applyForJob);
atsRouter.post('/resume-search/add', auth(['RECRUITER']), validateSchema(recruiterResumeWorkflowActionSchema), addResumeSearchCandidatesToAts);
atsRouter.post('/resume-search/shortlist', auth(['RECRUITER']), validateSchema(recruiterResumeWorkflowActionSchema), shortlistResumeSearchCandidates);
atsRouter.post('/resume-search/email', auth(['RECRUITER']), validateSchema(recruiterResumeEmailActionSchema), emailResumeSearchCandidates);
atsRouter.post('/resume-search/tag', auth(['RECRUITER']), validateSchema(recruiterResumeTagActionSchema), tagResumeSearchCandidates);
atsRouter.get('/pipeline', auth(['RECRUITER']), getPipeline);
atsRouter.get('/pipeline/:applicationId', auth(['RECRUITER']), getPipelineApplication);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), validateSchema(atsStageUpdateSchema), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), validateSchema(atsInterviewSchema), planInterview);
atsRouter.patch('/pipeline/:applicationId/interview/cancel', auth(['RECRUITER']), validateSchema(atsInterviewCancelSchema), cancelPlannedInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(['RECRUITER']), validateSchema(atsNoteSchema), createAtsNote);
atsRouter.patch('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), validateSchema(atsNoteUpdateSchema), editAtsNote);
atsRouter.delete('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), removeAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
