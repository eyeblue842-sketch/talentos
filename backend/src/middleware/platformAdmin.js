import { apiError } from '../utils/response.js';

// Stricter than auth(['ADMIN']) alone: that gate's ROLE_EQUIVALENTS also
// satisfies RECRUITER_ADMIN (an org-scoped admin), which is correct for the
// existing /api/admin/* endpoints (every one of them is internally scoped
// to the actor's own organisation) but would be a cross-tenant IDOR for the
// billing reconciliation endpoints below, which read/act across ALL
// organisations by design. Only true platform overseers (UserRole ADMIN or
// PLATFORM_ADMIN) may pass this check.
export function requirePlatformAdmin() {
  return (req, res, next) => {
    if (!['ADMIN', 'PLATFORM_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json(apiError('Platform administrator access required.'));
    }
    return next();
  };
}
