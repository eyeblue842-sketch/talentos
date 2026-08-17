import { assertOrganisationVerifiedForAction, ORGANISATION_DOMAIN_VERIFICATION_REQUIRED } from '../services/organisationVerificationGate.js';

// CAREERIZ EMPLOYER ACCESS, domain-ownership closure section 1: the route
// boundary for the same decision function used at every converged
// service-level activation point (see organisationVerificationGate.js's
// doc comment for why route middleware alone is not sufficient for
// multi-entry-point operations like job publishing). Applied at route
// boundaries alongside, not instead of, the existing entitlement gates in
// middleware/entitlement.js - this middleware only answers "is this
// organisation's DOMAIN identity verified", the entitlement gates
// separately answer "does this organisation's PLAN cover this feature".
// Both must pass.
//
// Reads req.user.activeMembership.organisation, which auth() already
// populates via resolveMembershipForRequest's `include: { organisation:
// true }` - zero additional queries.
export { ORGANISATION_DOMAIN_VERIFICATION_REQUIRED };

export function requireVerifiedOrganisation() {
  return (req, res, next) => {
    try {
      const organisationId = req.user?.activeMembership?.organisationId || null;
      assertOrganisationVerifiedForAction(req.user?.activeMembership?.organisation, organisationId);
      return next();
    } catch (error) {
      return res.status(error.statusCode || 403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
  };
}
