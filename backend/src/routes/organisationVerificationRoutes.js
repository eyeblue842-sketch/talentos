import { Router } from 'express';
import { adminOrganisationTypeReclassifySchema } from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platformAdmin.js';
import { validateSchema } from '../middleware/schema.js';
import {
  getPendingDomainVerifications,
  postApproveDomainVerification,
  postReclassifyOrganisationType,
} from '../controllers/organisationVerificationController.js';

export const organisationVerificationRouter = Router();

// Cross-tenant employer-identity review (spec section 2/4) - platform
// staff only, same rationale as adminBillingRoutes.js: every endpoint here
// reads/acts across organisations the actor does not belong to, so an
// org-scoped ADMIN/RECRUITER_ADMIN must not pass this gate.
organisationVerificationRouter.use(auth(['ADMIN']), requirePlatformAdmin());

organisationVerificationRouter.get('/pending', getPendingDomainVerifications);
organisationVerificationRouter.post('/:organisationId/approve', postApproveDomainVerification);
organisationVerificationRouter.post(
  '/:organisationId/type',
  validateSchema(adminOrganisationTypeReclassifySchema),
  postReclassifyOrganisationType
);
