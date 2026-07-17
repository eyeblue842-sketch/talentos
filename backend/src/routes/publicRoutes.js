import { Router } from 'express';
import { validateSchema } from '../middleware/schema.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { publicJobSearchQuerySchema } from '@careeriz/shared';
import {
  getPublicJob,
  getPublicOrganisation,
  getPublicOrganisationIndex,
  getPublicPortal,
  listPublicJobs,
} from '../controllers/publicController.js';

export const publicRouter = Router();

publicRouter.get('/portal', optionalAuth(), getPublicPortal);
publicRouter.get('/jobs', optionalAuth(), validateSchema(publicJobSearchQuerySchema, 'query'), listPublicJobs);
publicRouter.get('/jobs/:slug', optionalAuth(), getPublicJob);
publicRouter.get('/companies', optionalAuth(), getPublicOrganisationIndex);
publicRouter.get('/companies/:slug', optionalAuth(), validateSchema(publicJobSearchQuerySchema, 'query'), getPublicOrganisation);
