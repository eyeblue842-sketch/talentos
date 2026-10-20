import { Router } from 'express';
import { validateSchema } from '../middleware/schema.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { postAttributionEvent } from '../controllers/attributionController.js';
import { publicJobSearchQuerySchema } from '@careeriz/shared';
import {
  getPublicJob,
  getPublicOrganisation,
  getPublicOrganisationIndex,
  getPublicPortal,
  listPublicJobs,
} from '../controllers/publicController.js';

export const publicRouter = Router();

// First-party LinkedIn attribution beacon (opaque ref only, no personal data).
publicRouter.post(
  '/attribution',
  createRateLimiter({ keyPrefix: 'attribution', limit: 60, windowMinutes: 1, keyResolver: (req) => req.ip }),
  optionalAuth(),
  postAttributionEvent,
);

publicRouter.get('/portal', optionalAuth(), getPublicPortal);
publicRouter.get('/jobs', optionalAuth(), validateSchema(publicJobSearchQuerySchema, 'query'), listPublicJobs);
publicRouter.get('/jobs/:slug', optionalAuth(), getPublicJob);
publicRouter.get('/companies', optionalAuth(), getPublicOrganisationIndex);
publicRouter.get('/companies/:slug', optionalAuth(), validateSchema(publicJobSearchQuerySchema, 'query'), getPublicOrganisation);
