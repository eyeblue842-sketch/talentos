import { apiError } from '../utils/response.js';
import { env } from '../config/env.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Careeriz has exactly ONE global platform super administrator, identified by
// PLATFORM_SUPER_ADMIN_EMAIL. Authorization binds to that unique EMAIL (not to a
// mutable UserRole): the super admin is often also an ordinary organisation
// owner/recruiter, so overloading their UserRole with PLATFORM_ADMIN would strip
// their org-scoped access. The email is a stronger, single-account gate than any
// role - only one account can ever hold it, and org-role promotion can never
// confer it. Identity comes ONLY from the authenticated req.user populated
// server-side by auth(); a client-supplied email/role is never trusted. Fails
// closed when PLATFORM_SUPER_ADMIN_EMAIL is unset.
export function isPlatformSuperAdmin(user) {
  const configured = env.platformSuperAdminEmail;
  if (!configured) return false; // fail closed when unconfigured
  if (!user || user.isActive === false) return false;
  return normalizeEmail(user.email) === configured;
}

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

// Stricter than requirePlatformAdmin: gates the global /platform operator
// console to the single configured super-admin identity (role AND email). Used
// for every cross-organisation platform operation. Fails closed when
// PLATFORM_SUPER_ADMIN_EMAIL is unset.
export function requirePlatformSuperAdmin() {
  return (req, res, next) => {
    if (!isPlatformSuperAdmin(req.user)) {
      return res.status(403).json(apiError('Not found.', { code: 'PLATFORM_FORBIDDEN' }));
    }
    return next();
  };
}
