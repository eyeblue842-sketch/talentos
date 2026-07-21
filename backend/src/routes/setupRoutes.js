import { Router } from 'express';
import {
  initialSetupResetSchema,
  initialSetupSubmitSchema,
} from '@careeriz/shared';
import {
  getSetupStatus,
  postInitialSetup,
  postResetInitialSetup,
} from '../controllers/setupController.js';
import { auth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateSchema } from '../middleware/schema.js';

export const setupRouter = Router();

setupRouter.get('/status', getSetupStatus);
setupRouter.post('/', createRateLimiter({ keyPrefix: 'setup:create', limit: 3 }), validateSchema(initialSetupSubmitSchema), postInitialSetup);
setupRouter.post('/reset', auth(['ADMIN']), createRateLimiter({ keyPrefix: 'setup:reset', limit: 3 }), validateSchema(initialSetupResetSchema), postResetInitialSetup);
