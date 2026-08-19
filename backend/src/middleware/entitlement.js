import { getCurrentSubscription, isSubscriptionCurrentlyActive } from '../services/entitlementService.js';
import { isEntitlementEnforcementEnabled, shouldComputeShadowDecision, logEntitlementShadowDecision } from '../services/billingRolloutService.js';

// Central backend entitlement gates (section 9). These enforce access on
// the server regardless of what the frontend route guards do - every
// handler here still runs the underlying business logic's own
// organisation-scoping (requireOrganisationRole/requireOrganisationContext),
// this middleware only decides whether the ORG's plan currently permits the
// feature at all.
//
// Rollout kill-switch (B1 hardening, section 2): the access decision below
// is ALWAYS computed and ALWAYS logged (structured, PII-free shadow log),
// but is only actually enforced (able to return a 402/403 and block next())
// when isEntitlementEnforcementEnabled(organisationId) is true. See
// billingRolloutService.js for the exact production activation sequence.
// This is a server-side-only decision - nothing in the request (headers,
// query, body) can influence it.
function organisationIdFromRequest(req) {
  return req.user?.activeMembership?.organisationId || null;
}

function sendEntitlementError(res, statusCode, code, message) {
  return res.status(statusCode).json({ success: false, message, code });
}

async function resolveAccessState(organisationId) {
  const subscription = await getCurrentSubscription(organisationId);
  if (!subscription) {
    return { state: 'SUBSCRIPTION_REQUIRED' };
  }
  const active = await isSubscriptionCurrentlyActive(subscription);
  if (!active) {
    return { state: 'SUBSCRIPTION_EXPIRED', subscription };
  }
  return { state: 'ACTIVE', subscription };
}

function buildGate(feature, accessField, accessDeniedCode, accessDeniedMessage) {
  return () => async (req, res, next) => {
    try {
      const organisationId = organisationIdFromRequest(req);
      const enforced = isEntitlementEnforcementEnabled(organisationId);

      // Default posture (enforcement off, shadow-logging off): true no-op,
      // zero additional queries and zero additional rejections - existing
      // ATS/resume behaviour is bit-for-bit unchanged, not merely
      // "unblocked" (B1 hardening, section 2). This includes edge cases
      // like a recruiter with no resolved organisation membership, who the
      // pre-billing code already allowed through to some of these routes -
      // the kill-switch must not introduce a NEW rejection reason either.
      if (!enforced && !shouldComputeShadowDecision()) {
        return next();
      }

      if (!organisationId) {
        if (enforced) {
          return sendEntitlementError(res, 403, 'SUBSCRIPTION_REQUIRED', 'Organisation membership required.');
        }
        // Shadow-logging-only with no organisation context: nothing
        // meaningful to evaluate, and still must not block.
        return next();
      }

      const { state, subscription } = await resolveAccessState(organisationId);
      const wouldBlock = state === 'SUBSCRIPTION_REQUIRED'
        || state === 'SUBSCRIPTION_EXPIRED'
        || (state === 'ACTIVE' && !subscription?.[accessField]);

      logEntitlementShadowDecision({
        organisationId,
        feature,
        path: req.originalUrl,
        state,
        wouldBlock,
      });

      if (!enforced) {
        return next();
      }

      if (state === 'SUBSCRIPTION_REQUIRED') {
        return sendEntitlementError(res, 402, 'SUBSCRIPTION_REQUIRED', `An active ${feature} subscription is required for this action.`);
      }
      if (state === 'SUBSCRIPTION_EXPIRED') {
        return sendEntitlementError(res, 402, 'SUBSCRIPTION_EXPIRED', `Your subscription has expired. Renew to restore ${feature} access.`);
      }
      if (!subscription[accessField]) {
        return sendEntitlementError(res, 402, accessDeniedCode, accessDeniedMessage);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireAtsAccess = buildGate('ATS', 'atsAccess', 'ATS_ACCESS_REQUIRED', 'ATS access is not included in your current plan.');
export const requireResumeDatabaseAccess = buildGate('resume-database', 'resumeDatabaseAccess', 'RESUME_DATABASE_ACCESS_REQUIRED', 'Resume-database access is not included in your current plan.');

// A candidate downloading their OWN resume must never be blocked by
// billing state; only a recruiter pulling a candidate's resume out of the
// company's resume database is gated. The shared
// /resumes/candidate/:candidateId/download route serves both roles.
export function requireResumeDatabaseAccessForRecruiterDownload() {
  const gate = requireResumeDatabaseAccess();
  return (req, res, next) => {
    if (req.user?.role !== 'RECRUITER') {
      return next();
    }
    return gate(req, res, next);
  };
}
