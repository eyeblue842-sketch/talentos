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
import { requireVerifiedOrganisation } from '../middleware/organisationVerification.js';
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
// section 1). Also gated on domain verification (closure section 1):
// "access billing/invoices/payment administration" is explicitly listed as
// unavailable to a COMPANY/PENDING organisation.
billingRouter.get('/dashboard', auth(['RECRUITER']), requireVerifiedOrganisation(), getDashboard);
// Minimal, non-financial entitlement awareness for any org member with
// 'organisation.billing.summary.read' (RECRUITER/HIRING_MANAGER included).
// Deliberately NOT gated - this is exactly the "view/update limited safe
// account information" a PENDING organisation's user is allowed to see.
billingRouter.get('/entitlement-summary', auth(['RECRUITER']), getEntitlementSummaryRoute);
billingRouter.put('/profile', auth(['RECRUITER']), requireVerifiedOrganisation(), validateSchema(companyBillingProfileSchema), putBillingProfile);
billingRouter.post('/purchases', auth(['RECRUITER']), requireVerifiedOrganisation(), checkoutRateLimiter, validateSchema(createPurchaseIntentSchema), postPurchaseIntent);
// /purchases/verify is deliberately NOT gated here (corrected from the
// prior closure round - final publication-bypass closure section 2). By
// the time this endpoint is called, verifyCheckoutPayment requires
// Razorpay to already report the payment as `captured` - real money has
// already moved. Blocking here would strand an already-paid customer
// with no subscription and no way to retry, which is a worse outcome than
// the narrow edge case it would close (an organisation that created its
// purchase intent before becoming PENDING/before enforcement was turned
// on, then completes payment afterward). The actual growth-prevention
// gate is on /purchases above, which blocks BEFORE any payment can be
// initiated - this is a genuine, deliberate exception, not an oversight.
billingRouter.post('/purchases/verify', auth(['RECRUITER']), checkoutRateLimiter, validateSchema(verifyCheckoutPaymentSchema), postVerifyPurchase);
// Cancellation is deliberately NOT gated - it is a protective/no-growth
// action, and a PENDING organisation cannot have an active subscription to
// cancel in the first place (purchase itself is blocked above).
billingRouter.post('/subscription/cancel', auth(['RECRUITER']), validateSchema(cancelSubscriptionSchema), postCancelSubscription);
