import { env } from '../config/env.js';

// Rollout kill-switch for entitlement enforcement (B1 hardening, section 2).
//
// PRODUCTION ACTIVATION SEQUENCE (do this in order, do not skip steps):
//   1. Apply the billing migration to production (creates the tables; every
//      column defaults such that existing rows/behaviour are unaffected).
//   2. Deploy this code with BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED=false
//      (or simply omitted - that is the default). At this point the whole
//      billing module (pricing page, checkout, webhooks, dashboard,
//      purchases, ledger) is fully live and testable, but NO existing
//      organisation's ATS/resume-database access or job-publishing is
//      restricted - resolveAccessState/consumeJobCredit are still computed
//      on every request so you can watch the `billing.entitlement.shadow`
//      log line to see exactly what WOULD be blocked once enforcement
//      turns on, without blocking anyone.
//   3. Optionally canary a handful of internal/test organisations by adding
//      their ids to BILLING_ENTITLEMENT_ROLLOUT_ORG_IDS (comma-separated)
//      while the global flag stays false. Confirm their purchase +
//      entitlement flow end-to-end in production Test Mode.
//   4. Decide and execute the grace-period/migration plan for existing paid
//      organisations BEFORE flipping the global flag (see the "existing
//      customer rollout design" section of the hardening report this file
//      accompanies) - e.g. an administrator-issued, audited
//      ADMIN_ADJUSTMENT grant per organisation, sized and time-boxed by a
//      real business decision. This module deliberately does not create
//      such grants automatically.
//   5. Flip BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED=true (env var + restart/
//      redeploy - there is no runtime toggle and no client-facing control).
//      From this point every request is fully enforced server-side for
//      every organisation not already grandfathered in step 4.
//
// This value is read once from server-side environment configuration only.
// No request header, query parameter, cookie, or client-supplied value can
// influence it.
export function isEntitlementEnforcementEnabled(organisationId) {
  if (env.billingEntitlementEnforcementEnabled) return true;
  if (organisationId && env.billingEntitlementRolloutOrgIds.includes(organisationId)) return true;
  return false;
}

// Whether the gates should even bother computing+logging a shadow decision.
// Deliberately separate from isEntitlementEnforcementEnabled: an org that IS
// enforced obviously needs the real decision computed (not just "shadow"),
// so callers should treat `enforced || shouldComputeShadowDecision()` as
// "I need to run the query", and shouldComputeShadowDecision() alone as
// "purely for observability, opt-in, off by default".
export function shouldComputeShadowDecision() {
  return env.billingEntitlementShadowLoggingEnabled;
}

// Structured, safe shadow/audit log - never blocks, never throws, and never
// includes payment/PII fields. Emitted on every gated request/publish
// attempt regardless of whether enforcement is on, so operators can diff
// "what would have happened" against real outcomes before flipping the
// switch, and can retroactively investigate afterwards.
export function logEntitlementShadowDecision(payload) {
  console.log(JSON.stringify({
    level: 'info',
    event: 'billing.entitlement.shadow',
    enforcementEnabled: isEntitlementEnforcementEnabled(payload.organisationId),
    ...payload,
  }));
}
