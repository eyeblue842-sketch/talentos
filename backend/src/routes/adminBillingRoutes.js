import { Router } from 'express';
import {
  adminJobCreditAdjustmentSchema,
  adminSubscriptionActionSchema,
  adminManualPurchaseVerifySchema,
  adminRefundReviewSchema,
  billingResendReminderSchema,
} from '@careeriz/shared';
import { auth } from '../middleware/auth.js';
import { requirePlatformAdmin } from '../middleware/platformAdmin.js';
import { validateSchema } from '../middleware/schema.js';
import {
  getPurchases,
  getWebhookEvents,
  getCreditLedger,
  postAdjustCredits,
  postResendReminder,
  postSuspendSubscription,
  postReactivateSubscription,
  postManualVerify,
  postReviewRefund,
} from '../controllers/adminBillingController.js';

export const adminBillingRouter = Router();

// Cross-tenant payment reconciliation (section 15) - platform staff only,
// never an organisation's own admin (see requirePlatformAdmin's doc
// comment for why auth(['ADMIN']) alone is not strict enough here).
adminBillingRouter.use(auth(['ADMIN']), requirePlatformAdmin());

adminBillingRouter.get('/purchases', getPurchases);
adminBillingRouter.get('/webhook-events', getWebhookEvents);
adminBillingRouter.get('/organisations/:organisationId/credit-ledger', getCreditLedger);
adminBillingRouter.post('/credit-adjustments', validateSchema(adminJobCreditAdjustmentSchema), postAdjustCredits);
adminBillingRouter.post('/renewal-reminders/resend', validateSchema(billingResendReminderSchema), postResendReminder);
adminBillingRouter.post('/subscriptions/suspend', validateSchema(adminSubscriptionActionSchema), postSuspendSubscription);
adminBillingRouter.post('/subscriptions/reactivate', validateSchema(adminSubscriptionActionSchema), postReactivateSubscription);
adminBillingRouter.post('/purchases/manual-verify', validateSchema(adminManualPurchaseVerifySchema), postManualVerify);
adminBillingRouter.post('/purchases/review-refund', validateSchema(adminRefundReviewSchema), postReviewRefund);
