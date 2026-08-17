import {
  listPurchasesForReconciliation,
  listWebhookEventsForReconciliation,
  getCreditLedgerForOrganisation,
  resendRenewalReminder,
  suspendSubscription,
  reactivateSubscription,
  manuallyVerifyPurchase,
  reviewFlaggedRefund,
} from '../services/adminBillingService.js';
import { adminAdjustJobCredits } from '../services/entitlementService.js';
import { sendSuccess } from '../utils/response.js';

function meta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

export async function getPurchases(req, res, next) {
  try {
    const result = await listPurchasesForReconciliation(req.query);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getWebhookEvents(req, res, next) {
  try {
    const result = await listWebhookEventsForReconciliation(req.query);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCreditLedger(req, res, next) {
  try {
    const result = await getCreditLedgerForOrganisation(req.params.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postAdjustCredits(req, res, next) {
  try {
    const result = await adminAdjustJobCredits(req.user, req.body.organisationId, req.body.amount, req.body.reason, meta(req));
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postResendReminder(req, res, next) {
  try {
    const result = await resendRenewalReminder(req.user, req.body.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postSuspendSubscription(req, res, next) {
  try {
    const result = await suspendSubscription(req.user, req.body.organisationId, req.body.reason, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postReactivateSubscription(req, res, next) {
  try {
    const result = await reactivateSubscription(req.user, req.body.organisationId, req.body.reason, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postManualVerify(req, res, next) {
  try {
    const result = await manuallyVerifyPurchase(req.user, req.body.purchaseId, req.body.providerReference, req.body.reason, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postReviewRefund(req, res, next) {
  try {
    const result = await reviewFlaggedRefund(req.user, req.body.purchaseId, req.body.approve, req.body.reason, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
