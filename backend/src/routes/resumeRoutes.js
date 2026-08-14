import { Router } from 'express';
import {
  searchResumeDatabase,
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
import { requireResumeDatabaseAccess, requireResumeDatabaseAccessForRecruiterDownload } from '../middleware/entitlement.js';
import {
  recruiterResumeSearchSaveSchema,
  recruiterTalentPoolCandidateSchema,
  recruiterTalentPoolCreateSchema,
} from '@careeriz/shared';

export const resumeRouter = Router();

resumeRouter.get('/search', auth(['RECRUITER']), requireResumeDatabaseAccess(), searchResumeDatabase);
resumeRouter.get('/search/:candidateId', auth(['RECRUITER']), requireResumeDatabaseAccess(), getCandidateDetail);
resumeRouter.get('/preview/:candidateId', auth(['RECRUITER']), requireResumeDatabaseAccess(), getCandidatePreview);
resumeRouter.get('/saved', auth(['RECRUITER']), requireResumeDatabaseAccess(), listSavedCandidates);
resumeRouter.post('/saved/:candidateId', auth(['RECRUITER']), requireResumeDatabaseAccess(), saveCandidate);
resumeRouter.delete('/saved/:candidateId', auth(['RECRUITER']), requireResumeDatabaseAccess(), unsaveCandidate);
resumeRouter.get('/saved-searches', auth(['RECRUITER']), requireResumeDatabaseAccess(), listSavedSearches);
resumeRouter.post('/saved-searches', auth(['RECRUITER']), requireResumeDatabaseAccess(), validateSchema(recruiterResumeSearchSaveSchema), createSavedSearch);
resumeRouter.delete('/saved-searches/:searchId', auth(['RECRUITER']), requireResumeDatabaseAccess(), deleteSavedSearch);
resumeRouter.get('/talent-pools', auth(['RECRUITER']), requireResumeDatabaseAccess(), getTalentPools);
resumeRouter.post('/talent-pools', auth(['RECRUITER']), requireResumeDatabaseAccess(), validateSchema(recruiterTalentPoolCreateSchema), postTalentPool);
resumeRouter.post('/talent-pools/:poolId/candidates', auth(['RECRUITER']), requireResumeDatabaseAccess(), validateSchema(recruiterTalentPoolCandidateSchema), postTalentPoolCandidates);
resumeRouter.patch('/profile', auth(['CANDIDATE']), updateCandidateProfile);
resumeRouter.get('/candidate/:candidateId/download', auth(['RECRUITER', 'CANDIDATE']), requireResumeDatabaseAccessForRecruiterDownload(), downloadCandidateResume);
resumeRouter.get('/recommended-jobs', auth(['CANDIDATE']), recommendedJobs);
resumeRouter.post('/upload', auth(['CANDIDATE']), upload.single('resume'), uploadResume);
resumeRouter.get('/pdf', auth(['CANDIDATE']), downloadResumePdf);
