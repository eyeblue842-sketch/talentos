import { Router } from 'express';
import {
  createPurchaseIntentSchema,
  verifyCheckoutPaymentSchema,
  companyBillingProfileSchema,
  cancelSubscriptionSchema,
} from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import {
  getCatalogue,
  postPurchaseIntent,
  postVerifyPurchase,
  getDashboard,
  getEntitlementSummaryRoute,
  putBillingProfile,
  postCancelSubscription,
} from '../controllers/billingController.js';

export const billingRouter = Router();

// Checkout-adjacent endpoints are rate-limited per organisation/user
// (section 16). The webhook route has its own limiter, applied where it is
// mounted in app.js (ahead of the JSON body parser).
const checkoutRateLimiter = createRateLimiter({
  keyPrefix: 'billing:checkout',
  limit: 20,
  windowMinutes: 15,
  keyResolver: (req) => req.user?.activeMembership?.organisationId || req.ip,
});

billingRouter.get('/catalogue', getCatalogue);
// Full dashboard (invoices, payment references, purchase history, billing
// profile/GSTIN) - OWNER/ADMIN/platform-admin only, enforced inside
// getBillingDashboard via 'organisation.billing.read' (B2 hardening,
// section 1). A plain RECRUITER/HIRING_MANAGER gets 403 here and must use
// /entitlement-summary instead.
billingRouter.get('/dashboard', auth(['RECRUITER']), getDashboard);
// Minimal, non-financial entitlement awareness for any org member with
// 'organisation.billing.summary.read' (RECRUITER/HIRING_MANAGER included).
billingRouter.get('/entitlement-summary', auth(['RECRUITER']), getEntitlementSummaryRoute);
billingRouter.put('/profile', auth(['RECRUITER']), validateSchema(companyBillingProfileSchema), putBillingProfile);
billingRouter.post('/purchases', auth(['RECRUITER']), checkoutRateLimiter, validateSchema(createPurchaseIntentSchema), postPurchaseIntent);
billingRouter.post('/purchases/verify', auth(['RECRUITER']), checkoutRateLimiter, validateSchema(verifyCheckoutPaymentSchema), postVerifyPurchase);
billingRouter.post('/subscription/cancel', auth(['RECRUITER']), validateSchema(cancelSubscriptionSchema), postCancelSubscription);
