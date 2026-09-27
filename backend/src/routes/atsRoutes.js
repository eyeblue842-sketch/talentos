import { Router } from 'express';
import multer from 'multer';
import {
  applyForJob,
  addResumeSearchCandidatesToAts,
  getAtsOpenings,
  postAtsOpening,
  postCandidateInvite,
  getAssessmentTemplates,
  postAssessmentTemplate,
  patchAssessmentTemplate,
  removeAssessmentTemplate,
  getOfferTemplates,
  postOfferTemplate,
  patchOfferTemplate,
  removeOfferTemplate,
  postOfferTemplateDocument,
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
import { requireVerifiedOrganisation } from '../middleware/organisationVerification.js';
import {
  applyToJobSchema,
  atsInterviewCancelSchema,
  atsInterviewSchema,
  atsNoteSchema,
  atsNoteUpdateSchema,
  atsStageUpdateSchema,
  candidateInviteSchema,
  recruiterResumeEmailActionSchema,
  recruiterResumeTagActionSchema,
  recruiterResumeWorkflowActionSchema,
} from '@careeriz/shared';

export const atsRouter = Router();

// Candidate-facing endpoints stay open regardless of the company's plan
// (section 6/9) - only the recruiter-facing ATS surface below is gated.
atsRouter.post('/apply', auth(['CANDIDATE']), validateSchema(applyToJobSchema), applyForJob);
atsRouter.post('/resume-search/add', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(recruiterResumeWorkflowActionSchema), addResumeSearchCandidatesToAts);
atsRouter.post('/resume-search/shortlist', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(recruiterResumeWorkflowActionSchema), shortlistResumeSearchCandidates);
atsRouter.post('/resume-search/email', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(recruiterResumeEmailActionSchema), emailResumeSearchCandidates);
atsRouter.post('/resume-search/tag', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(recruiterResumeTagActionSchema), tagResumeSearchCandidates);
atsRouter.get('/openings', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), getAtsOpenings);
atsRouter.post('/openings', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), postAtsOpening);
atsRouter.post('/invites', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(candidateInviteSchema), postCandidateInvite);
atsRouter.get('/assessment-templates', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), getAssessmentTemplates);
atsRouter.post('/assessment-templates', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), postAssessmentTemplate);
atsRouter.patch('/assessment-templates/:templateId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), patchAssessmentTemplate);
atsRouter.delete('/assessment-templates/:templateId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), removeAssessmentTemplate);
atsRouter.get('/offer-templates', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), getOfferTemplates);
atsRouter.post('/offer-templates', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), postOfferTemplate);
atsRouter.patch('/offer-templates/:templateId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), patchOfferTemplate);
atsRouter.delete('/offer-templates/:templateId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), removeOfferTemplate);
const offerTemplateDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
atsRouter.post('/offer-templates/:templateId/document', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), offerTemplateDocUpload.single('file'), postOfferTemplateDocument);
atsRouter.get('/pipeline', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), getPipeline);
atsRouter.get('/pipeline/:applicationId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), getPipelineApplication);
atsRouter.patch('/pipeline/:applicationId/stage', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(atsStageUpdateSchema), movePipelineStage);
atsRouter.patch('/pipeline/:applicationId/interview', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(atsInterviewSchema), planInterview);
atsRouter.patch('/pipeline/:applicationId/interview/cancel', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(atsInterviewCancelSchema), cancelPlannedInterview);
atsRouter.post('/pipeline/:applicationId/notes', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(atsNoteSchema), createAtsNote);
atsRouter.patch('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), validateSchema(atsNoteUpdateSchema), editAtsNote);
atsRouter.delete('/pipeline/:applicationId/notes/:noteId', auth(['RECRUITER']), requireAtsAccess(), requireVerifiedOrganisation(), removeAtsNote);
atsRouter.get('/applications', auth(['CANDIDATE']), getCandidateApplicationList);
