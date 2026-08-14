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
import { requireAtsAccess } from '../middleware/entitlement.js';
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

// Candidate-facing endpoints stay open regardless of the company's plan
// (section 6/9) - only the recruiter-facing ATS surface below is gated.
atsRouter.post('/apply', auth(['CANDIDATE']), validateSchema(applyToJobSchema), applyForJob);
atsRouter.post('/resume-search/add', auth(['RECRUITER']), requireAtsAccess(), validateSchema(recruiterResumeWorkflowActionSchema), addResumeSearchCandidatesToAts);
atsRouter.post('/resume-search/shortlist', auth(['RECRUITER']), requireAtsAccess(), validateSchema(recruiterResumeWorkflowActionSchema), shortlistResumeSearchCandidates);
atsRouter.post('/resume-search/email', auth(['RECRUITER']), requireAtsAccess(), validateSchema(recruiterResumeEmailActionSchema), emailResumeSearchCandidates);
atsRouter.post('/resume-search/tag', auth(['RECRUITER']), requireAtsAccess(), validateSchema(recruiterResumeTagActionSchema), tagResumeSearchCandidates);
atsRouter.get('/pipeline', auth(['RECRUITER']), requireAtsAccess(), getPipeline);
atsRouter.get('/pipeline/:applicationId', auth(['RECRUITER']), requireAtsAccess(), getPipelineApplication);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), requireAtsAccess(), validateSchema(atsStageUpdateSchema), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), requireAtsAccess(), validateSchema(atsInterviewSchema), planInterview);
atsRouter.patch('/pipeline/:applicationId/interview/cancel', auth(['RECRUITER']), requireAtsAccess(), validateSchema(atsInterviewCancelSchema), cancelPlannedInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(['RECRUITER']), requireAtsAccess(), validateSchema(atsNoteSchema), createAtsNote);
atsRouter.patch('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), requireAtsAccess(), validateSchema(atsNoteUpdateSchema), editAtsNote);
atsRouter.delete('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), requireAtsAccess(), removeAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
