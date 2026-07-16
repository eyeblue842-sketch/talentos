import { Router } from 'express';
import {
  searchResumeDatabase,
  getCandidateDetail,
  updateCandidateProfile,
  uploadResume,
  saveCandidate,
  listSavedCandidates,
  downloadResumePdf,
  recommendedJobs,
} from '../controllers/resumeController.js';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

export const resumeRouter = Router();

resumeRouter.get('/search', auth(['RECRUITER']), searchResumeDatabase);
resumeRouter.get('/search/:candidateId', auth(['RECRUITER']), getCandidateDetail);
resumeRouter.get('/saved', auth(['RECRUITER']), listSavedCandidates);
resumeRouter.post('/saved/:candidateId', auth(['RECRUITER']), saveCandidate);
resumeRouter.patch('/profile', auth(['CANDIDATE']), updateCandidateProfile);
resumeRouter.get('/recommended-jobs', auth(['CANDIDATE']), recommendedJobs);
resumeRouter.post('/upload', auth(['CANDIDATE']), upload.single('resume'), uploadResume);
resumeRouter.get('/pdf', auth(['CANDIDATE']), downloadResumePdf);
