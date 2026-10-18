import { sendSuccess } from '../utils/response.js';
import { getPlatformOverview, listOrganisations, getOrganisationDetail } from '../services/platformService.js';
import {
  suspendSubscription,
  reactivateSubscription,
  manuallyVerifyPurchase,
  reviewFlaggedRefund,
  resendRenewalReminder,
  grantComplimentarySubscription,
} from '../services/adminBillingService.js';
import { adminAdjustJobCredits } from '../services/entitlementService.js';
import { getProductCatalogue, isSubscriptionProduct } from '../services/productCatalogueService.js';
import {
  platformInviteUser,
  platformChangeUserEmail,
  platformSetUserActive,
} from '../services/platformUserAdminService.js';

// Request fingerprint carried into every audit log the billing primitives write.
function meta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

// All platform billing ops are consequential and audited, so a human-readable
// reason is mandatory (spec: "record the administrator, target account,
// timestamp, reason, and result"). Throws a 400 the error middleware renders.
function requireReason(req) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) {
    const error = new Error('A reason is required for this action.');
    error.statusCode = 400;
    error.code = 'REASON_REQUIRED';
    throw error;
  }
  return reason;
}

// Identity echo for the platform console. Reaching this means auth() + the
// super-admin guard already passed, so it simply confirms the session.
export async function getPlatformSession(req, res, next) {
  try {
    sendSuccess(res, 200, { email: req.user.email, name: req.user.name || null, isSuperAdmin: true });
  } catch (error) {
    next(error);
  }
}

export async function getOverview(req, res, next) {
  try {
    sendSuccess(res, 200, await getPlatformOverview());
  } catch (error) {
    next(error);
  }
}

export async function getOrganisations(req, res, next) {
  try {
    const { items, meta } = await listOrganisations({
      search: req.query.search,
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    sendSuccess(res, 200, items, meta);
  } catch (error) {
    next(error);
  }
}

export async function getOrganisationDetailController(req, res, next) {
  try {
    sendSuccess(res, 200, await getOrganisationDetail(req.params.organisationId));
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Phase 3 - billing operations.
//
// Every handler reuses the SAME audited, idempotent primitives the role-based
// /api/admin/billing console uses (adminBillingService / entitlementService),
// passing the authenticated super admin as the actor. We add no new billing
// logic here - the console is a second, email-gated entry point to the existing
// money-safe operations. After a mutation we return the refreshed organisation
// detail so the console re-renders from a single source of truth.
// ---------------------------------------------------------------------------

export async function suspendSubscriptionController(req, res, next) {
  try {
    const reason = requireReason(req);
    const result = await suspendSubscription(req.user, req.params.organisationId, reason, meta(req));
    const organisation = await getOrganisationDetail(req.params.organisationId);
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function reactivateSubscriptionController(req, res, next) {
  try {
    const reason = requireReason(req);
    const result = await reactivateSubscription(req.user, req.params.organisationId, reason, meta(req));
    const organisation = await getOrganisationDetail(req.params.organisationId);
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function adjustCreditsController(req, res, next) {
  try {
    const reason = requireReason(req);
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount === 0) {
      const error = new Error('A non-zero whole-number credit adjustment is required.');
      error.statusCode = 400;
      error.code = 'INVALID_CREDIT_AMOUNT';
      throw error;
    }
    const result = await adminAdjustJobCredits(req.user, req.params.organisationId, amount, reason, meta(req));
    const organisation = await getOrganisationDetail(req.params.organisationId);
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function resendRenewalReminderController(req, res, next) {
  try {
    const result = await resendRenewalReminder(req.user, req.params.organisationId, meta(req));
    sendSuccess(res, 200, { result });
  } catch (error) {
    next(error);
  }
}

export async function reconcilePurchaseController(req, res, next) {
  try {
    const reason = requireReason(req);
    const providerReference = typeof req.body?.providerReference === 'string' ? req.body.providerReference.trim() : '';
    if (!providerReference) {
      const error = new Error('The provider payment/reference id is required to reconcile.');
      error.statusCode = 400;
      error.code = 'PROVIDER_REFERENCE_REQUIRED';
      throw error;
    }
    // Idempotent + money-safe: the primitive re-fetches the payment from the
    // provider and only activates when captured + amount/currency/order match.
    const result = await manuallyVerifyPurchase(req.user, req.params.purchaseId, providerReference, reason, meta(req));
    const organisation = result?.organisationId ? await getOrganisationDetail(result.organisationId) : null;
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function reviewRefundController(req, res, next) {
  try {
    const reason = requireReason(req);
    if (typeof req.body?.approve !== 'boolean') {
      const error = new Error('An explicit approve (true/false) decision is required.');
      error.statusCode = 400;
      error.code = 'REFUND_DECISION_REQUIRED';
      throw error;
    }
    const result = await reviewFlaggedRefund(req.user, req.params.purchaseId, req.body.approve, reason, meta(req));
    const organisation = result?.organisationId ? await getOrganisationDetail(result.organisationId) : null;
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

// The subscription plans that can be comped (subscription products only; the
// one-off job-post credit is excluded). Feeds the console's grant dropdown.
export async function getComplimentaryPlans(req, res, next) {
  try {
    const catalogue = await getProductCatalogue();
    const plans = catalogue
      .filter((plan) => isSubscriptionProduct(plan.code))
      // Shortest term first so the console defaults to the 1-month plan, which
      // is the usual initial complimentary grant.
      .sort((a, b) => (a.durationMonths || 0) - (b.durationMonths || 0))
      .map((plan) => ({
        code: plan.code,
        name: plan.name,
        durationMonths: plan.durationMonths,
        includedJobCredits: plan.includedJobCredits,
      }));
    sendSuccess(res, 200, plans);
  } catch (error) {
    next(error);
  }
}

export async function grantComplimentaryController(req, res, next) {
  try {
    const reason = requireReason(req);
    const productCode = typeof req.body?.productCode === 'string' ? req.body.productCode.trim() : '';
    if (!productCode) {
      const error = new Error('A product plan is required for a complimentary grant.');
      error.statusCode = 400;
      error.code = 'PRODUCT_CODE_REQUIRED';
      throw error;
    }
    const result = await grantComplimentarySubscription(req.user, req.params.organisationId, { productCode, reason }, meta(req));
    const organisation = await getOrganisationDetail(req.params.organisationId);
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Phase 4 - user / email administration. Cross-tenant writes via
// platformUserAdminService (ownership invariant + session invalidation live in
// the service). Mutations return the refreshed organisation detail so the
// console re-renders from one source of truth.
// ---------------------------------------------------------------------------

export async function inviteUserController(req, res, next) {
  try {
    const result = await platformInviteUser(
      req.user,
      req.params.organisationId,
      { email: req.body?.email, role: req.body?.role },
      meta(req),
    );
    const organisation = await getOrganisationDetail(req.params.organisationId);
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function changeUserEmailController(req, res, next) {
  try {
    const reason = requireReason(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email) {
      const error = new Error('A new email address is required.');
      error.statusCode = 400;
      error.code = 'EMAIL_REQUIRED';
      throw error;
    }
    const result = await platformChangeUserEmail(req.user, req.params.userId, email, reason, meta(req));
    const organisation = req.body?.organisationId ? await getOrganisationDetail(req.body.organisationId) : null;
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}

export async function setUserActiveController(req, res, next) {
  try {
    const reason = requireReason(req);
    if (typeof req.body?.active !== 'boolean') {
      const error = new Error('An explicit active (true/false) value is required.');
      error.statusCode = 400;
      error.code = 'ACTIVE_FLAG_REQUIRED';
      throw error;
    }
    const result = await platformSetUserActive(req.user, req.params.userId, req.body.active, reason, meta(req));
    const organisation = req.body?.organisationId ? await getOrganisationDetail(req.body.organisationId) : null;
    sendSuccess(res, 200, { result, organisation });
  } catch (error) {
    next(error);
  }
}
