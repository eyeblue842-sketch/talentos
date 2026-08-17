import {
  getPublicCatalogue,
  createPurchaseIntent,
  verifyCheckoutPayment,
  getBillingDashboard,
  getBillingEntitlementSummary,
  upsertBillingProfile,
  cancelSubscription,
  handleRazorpayWebhook,
} from '../services/billingService.js';
import { sendSuccess } from '../utils/response.js';

function meta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

function organisationIdOf(req) {
  return req.user?.activeMembership?.organisationId || null;
}

export async function getCatalogue(req, res, next) {
  try {
    const result = await getPublicCatalogue();
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postPurchaseIntent(req, res, next) {
  try {
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const result = await createPurchaseIntent(req.user, organisationIdOf(req), req.body.productCode, meta(req), idempotencyKey);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postVerifyPurchase(req, res, next) {
  try {
    const result = await verifyCheckoutPayment(req.user, organisationIdOf(req), req.body, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const result = await getBillingDashboard(req.user, organisationIdOf(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getEntitlementSummaryRoute(req, res, next) {
  try {
    const result = await getBillingEntitlementSummary(req.user, organisationIdOf(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function putBillingProfile(req, res, next) {
  try {
    const result = await upsertBillingProfile(req.user, organisationIdOf(req), req.body, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postCancelSubscription(req, res, next) {
  try {
    const result = await cancelSubscription(req.user, organisationIdOf(req), req.body.reason, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

// Not JWT-authenticated - authenticity comes entirely from the Razorpay
// HMAC signature over the raw body (verified inside handleRazorpayWebhook).
// req.body here is the raw Buffer (see the express.raw() mount in app.js),
// never the parsed JSON body.
export async function postRazorpayWebhook(req, res, next) {
  try {
    const signature = req.get('x-razorpay-signature');
    const eventIdHeader = req.get('x-razorpay-event-id') || null;
    const result = await handleRazorpayWebhook({ rawBody: req.body, signature, eventIdHeader });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
