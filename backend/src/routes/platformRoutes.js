import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requirePlatformSuperAdmin } from '../middleware/platformAdmin.js';
import {
  getPlatformSession,
  getOverview,
  getOrganisations,
  getOrganisationDetailController,
  suspendSubscriptionController,
  reactivateSubscriptionController,
  adjustCreditsController,
  resendRenewalReminderController,
  reconcilePurchaseController,
  reviewRefundController,
  getComplimentaryPlans,
  grantComplimentaryController,
  inviteUserController,
  changeUserEmailController,
  setUserActiveController,
} from '../controllers/platformController.js';

// Global platform operator console (feature/platform-super-admin). EVERY route
// is double-gated: auth() establishes an authenticated, active account (valid
// token + session), then requirePlatformSuperAdmin() narrows to the single
// configured super-admin EMAIL. Any other authenticated user (including every
// organisation admin) reaches the guard and is rejected - access is bound to
// the unique owner email, not to a role that the owner also needs for their own
// organisation.
export const platformRouter = Router();

platformRouter.use(auth(), requirePlatformSuperAdmin());

platformRouter.get('/session', getPlatformSession);
platformRouter.get('/overview', getOverview);
platformRouter.get('/organisations', getOrganisations);
platformRouter.get('/organisations/:organisationId', getOrganisationDetailController);

// Phase 3 - billing operations (all audited + idempotent; reuse adminBillingService).
platformRouter.post('/organisations/:organisationId/subscription/suspend', suspendSubscriptionController);
platformRouter.post('/organisations/:organisationId/subscription/reactivate', reactivateSubscriptionController);
platformRouter.post('/organisations/:organisationId/credits', adjustCreditsController);
platformRouter.post('/organisations/:organisationId/renewal-reminder', resendRenewalReminderController);
platformRouter.post('/purchases/:purchaseId/reconcile', reconcilePurchaseController);
platformRouter.post('/purchases/:purchaseId/review-refund', reviewRefundController);
platformRouter.get('/products/complimentary', getComplimentaryPlans);
platformRouter.post('/organisations/:organisationId/subscription/complimentary', grantComplimentaryController);

// Phase 4 - user / email administration.
platformRouter.post('/organisations/:organisationId/users/invite', inviteUserController);
platformRouter.post('/users/:userId/email', changeUserEmailController);
platformRouter.post('/users/:userId/active', setUserActiveController);
