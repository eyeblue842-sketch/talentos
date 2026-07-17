import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { upload } from '../middleware/upload.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateSchema } from '../middleware/schema.js';
import {
  jobApplicationListQuerySchema,
  jobQuestionAddFromLibrarySchema,
  jobScreeningQuestionReorderSchema,
  jobScreeningQuestionUpdateSchema,
  publicJobEligibilityQuerySchema,
  screeningTemplateArchiveSchema,
  screeningTemplateCreateSchema,
  screeningTemplateListQuerySchema,
  screeningTemplateUpdateSchema,
  submitJobApplicationSchema,
  validateJobApplicationAnswersSchema,
} from '@careeriz/shared';
import {
  deleteJobQuestion,
  downloadCandidateResumeFile,
  downloadRecruiterAnswerFile,
  downloadRecruiterApplicationResume,
  getCandidateApplicationV2,
  getCandidateApplicationsV2,
  getCandidateResumes,
  getJobQuestionPreview,
  getJobQuestions,
  getPublicJobApplyData,
  getQuestionTemplates,
  getRecruiterApplicationV2,
  getRecruiterApplicationsV2,
  patchJobQuestion,
  patchQuestionTemplate,
  postCandidateAnswerFile,
  postCandidateResume,
  postJobQuestion,
  postJobQuestionDuplicate,
  postJobQuestionFromLibrary,
  postJobQuestionReorder,
  postQuestionTemplate,
  postQuestionTemplateArchive,
  postQuestionTemplateDuplicate,
  submitCandidateApplication,
  validateCandidateApplication,
} from '../controllers/applicationWorkflowController.js';

export const applicationWorkflowRouter = Router();

applicationWorkflowRouter.get('/public/jobs/:slug/apply', optionalAuth(), validateSchema(publicJobEligibilityQuerySchema.partial(), 'query'), getPublicJobApplyData);

applicationWorkflowRouter.get('/jobs/screening-templates', auth(['RECRUITER']), validateSchema(screeningTemplateListQuerySchema.partial(), 'query'), getQuestionTemplates);
applicationWorkflowRouter.post('/jobs/screening-templates', auth(['RECRUITER']), validateSchema(screeningTemplateCreateSchema), postQuestionTemplate);
applicationWorkflowRouter.patch('/jobs/screening-templates/:templateId', auth(['RECRUITER']), validateSchema(screeningTemplateUpdateSchema), patchQuestionTemplate);
applicationWorkflowRouter.post('/jobs/screening-templates/:templateId/archive', auth(['RECRUITER']), validateSchema(screeningTemplateArchiveSchema), postQuestionTemplateArchive);
applicationWorkflowRouter.post('/jobs/screening-templates/:templateId/duplicate', auth(['RECRUITER']), postQuestionTemplateDuplicate);

applicationWorkflowRouter.get('/jobs/:jobId/screening-questions', auth(['RECRUITER']), getJobQuestions);
applicationWorkflowRouter.post('/jobs/:jobId/screening-questions', auth(['RECRUITER']), validateSchema(screeningTemplateCreateSchema), postJobQuestion);
applicationWorkflowRouter.post('/jobs/:jobId/screening-questions/from-library', auth(['RECRUITER']), validateSchema(jobQuestionAddFromLibrarySchema), postJobQuestionFromLibrary);
applicationWorkflowRouter.patch('/jobs/:jobId/screening-questions/:questionId', auth(['RECRUITER']), validateSchema(jobScreeningQuestionUpdateSchema), patchJobQuestion);
applicationWorkflowRouter.post('/jobs/:jobId/screening-questions/reorder', auth(['RECRUITER']), validateSchema(jobScreeningQuestionReorderSchema), postJobQuestionReorder);
applicationWorkflowRouter.post('/jobs/:jobId/screening-questions/:questionId/duplicate', auth(['RECRUITER']), postJobQuestionDuplicate);
applicationWorkflowRouter.delete('/jobs/:jobId/screening-questions/:questionId', auth(['RECRUITER']), deleteJobQuestion);
applicationWorkflowRouter.get('/jobs/:jobId/screening-questions/preview', auth(['RECRUITER']), getJobQuestionPreview);

applicationWorkflowRouter.get('/candidate/resumes', auth(['CANDIDATE']), getCandidateResumes);
applicationWorkflowRouter.post('/candidate/resumes', auth(['CANDIDATE']), upload.single('resume'), postCandidateResume);
applicationWorkflowRouter.get('/candidate/resumes/:assetId/download', auth(['CANDIDATE']), downloadCandidateResumeFile);
applicationWorkflowRouter.post('/candidate/application-files', auth(['CANDIDATE']), upload.single('file'), postCandidateAnswerFile);
applicationWorkflowRouter.post('/candidate/applications/validate', auth(['CANDIDATE']), validateSchema(validateJobApplicationAnswersSchema), validateCandidateApplication);
applicationWorkflowRouter.post('/candidate/applications', createRateLimiter({ keyPrefix: 'candidate-application-submit', limit: 10 }), auth(['CANDIDATE']), validateSchema(submitJobApplicationSchema), submitCandidateApplication);
applicationWorkflowRouter.get('/candidate/applications', auth(['CANDIDATE']), getCandidateApplicationsV2);
applicationWorkflowRouter.get('/candidate/applications/:applicationId', auth(['CANDIDATE']), getCandidateApplicationV2);

applicationWorkflowRouter.get('/ats/applications', auth(['RECRUITER']), validateSchema(jobApplicationListQuerySchema.partial(), 'query'), getRecruiterApplicationsV2);
applicationWorkflowRouter.get('/ats/applications/:applicationId', auth(['RECRUITER']), getRecruiterApplicationV2);
applicationWorkflowRouter.get('/ats/applications/:applicationId/resume', auth(['RECRUITER']), downloadRecruiterApplicationResume);
applicationWorkflowRouter.get('/ats/files/:assetId', auth(['RECRUITER']), downloadRecruiterAnswerFile);
