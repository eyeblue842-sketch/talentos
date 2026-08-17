import { Router } from 'express';
import {
  searchResumeDatabase,
  searchResumeDatabaseV2,
  getCandidateDetail,
  getCandidatePreview,
  updateCandidateProfile,
  uploadResume,
  saveCandidate,
  unsaveCandidate,
  listSavedCandidates,
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  getTalentPools,
  postTalentPool,
  postTalentPoolCandidates,
  downloadResumePdf,
  downloadCandidateResume,
  recommendedJobs,
} from '../controllers/resumeController.js';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validateSchema } from '../middleware/schema.js';
import {
  recruiterResumeSearchSaveSchema,
  resumeSearchV2RequestSchema,
  recruiterTalentPoolCandidateSchema,
  recruiterTalentPoolCreateSchema,
} from '@careeriz/shared';

export const resumeRouter = Router();

resumeRouter.get('/search', auth(['RECRUITER']), searchResumeDatabase);
resumeRouter.post('/search/v2', auth(['RECRUITER', 'ADMIN']), validateSchema(resumeSearchV2RequestSchema), searchResumeDatabaseV2);
resumeRouter.get('/search/:candidateId', auth(['RECRUITER']), getCandidateDetail);
resumeRouter.get('/preview/:candidateId', auth(['RECRUITER']), getCandidatePreview);
resumeRouter.get('/saved', auth(['RECRUITER']), listSavedCandidates);
resumeRouter.post('/saved/:candidateId', auth(['RECRUITER']), saveCandidate);
resumeRouter.delete('/saved/:candidateId', auth(['RECRUITER']), unsaveCandidate);
resumeRouter.get('/saved-searches', auth(['RECRUITER']), listSavedSearches);
resumeRouter.post('/saved-searches', auth(['RECRUITER']), validateSchema(recruiterResumeSearchSaveSchema), createSavedSearch);
resumeRouter.delete('/saved-searches/:searchId', auth(['RECRUITER']), deleteSavedSearch);
resumeRouter.get('/talent-pools', auth(['RECRUITER']), getTalentPools);
resumeRouter.post('/talent-pools', auth(['RECRUITER']), validateSchema(recruiterTalentPoolCreateSchema), postTalentPool);
resumeRouter.post('/talent-pools/:poolId/candidates', auth(['RECRUITER']), validateSchema(recruiterTalentPoolCandidateSchema), postTalentPoolCandidates);
resumeRouter.patch('/profile', auth(['CANDIDATE']), updateCandidateProfile);
resumeRouter.get('/candidate/:candidateId/download', auth(['RECRUITER', 'CANDIDATE']), downloadCandidateResume);
resumeRouter.get('/recommended-jobs', auth(['CANDIDATE']), recommendedJobs);
resumeRouter.post('/upload', auth(['CANDIDATE']), upload.single('resume'), uploadResume);
resumeRouter.get('/pdf', auth(['CANDIDATE']), downloadResumePdf);
