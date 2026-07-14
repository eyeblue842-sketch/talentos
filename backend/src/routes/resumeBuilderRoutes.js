import { Router } from 'express';
import { getResumeBuilderState, saveResumeBuilder } from '../controllers/resumeBuilderController.js';
import { auth } from '../middleware/auth.js';

export const resumeBuilderRouter = Router();

resumeBuilderRouter.get('/', auth(['CANDIDATE']), getResumeBuilderState);
resumeBuilderRouter.put('/', auth(['CANDIDATE']), saveResumeBuilder);
