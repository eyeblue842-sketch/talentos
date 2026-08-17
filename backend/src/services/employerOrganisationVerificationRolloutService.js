import { env } from '../config/env.js';

// Rollout kill-switch for the PENDING-company access gate (domain-ownership
// closure, section 1). Mirrors billingRolloutService.js's proven pattern
// exactly, for the same reason: deploying this code must never lock out an
// organisation created before this feature existed.
//
// PRODUCTION ACTIVATION SEQUENCE:
//   1. Apply the domain-ownership migration to production. Every existing
//      row keeps type=null / domainVerificationStatus=NOT_APPLICABLE -
//      nothing is auto-reclassified, so nothing is affected yet.
//   2. Deploy this code with EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED
//      left unset/false. The gate is fully wired but is a true no-op.
//   3. Optionally canary specific organisations via
//      EMPLOYER_ORGANISATION_VERIFICATION_ROLLOUT_ORG_IDS (comma-separated)
//      while the global flag stays false.
//   4. Review/classify existing organisations that would land in
//      type=COMPANY, domainVerificationStatus=PENDING before flipping the
//      global flag, so no legitimate existing customer is blocked.
//   5. Flip EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED=true
//      (env var + redeploy only - no runtime/client-facing toggle).
//
// Server-side environment configuration only - no request header, query
// parameter, cookie, or client-supplied value can influence this.
export function isOrganisationVerificationEnforcementEnabled(organisationId) {
  if (env.employerOrganisationVerificationEnforcementEnabled) return true;
  if (organisationId && env.employerOrganisationVerificationRolloutOrgIds.includes(organisationId)) return true;
  return false;
}
