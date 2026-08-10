import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { apiError } from '../utils/response.js';
import { getRequestOrganisationId, resolveMembershipForRequest } from '../services/organisationAccessService.js';

// Portal-scoped admin roles satisfy the gate for the ordinary role(s) they
// extend. CANDIDATE_ADMIN behaves as a normal candidate everywhere (no
// candidate-admin-only surfaces exist yet). RECRUITER_ADMIN is a full working
// recruiter (job posting, ATS, etc. - the same real OrganisationMembership any
// recruiter OWNER has) plus the recruiter/organisation admin panel, scoped to
// its own organisation. PLATFORM_ADMIN is deliberately narrower: it satisfies
// only ADMIN-gated routes (system-wide administration), not RECRUITER-only
// business routes, since it is an overseer role, not a working recruiter.
const ROLE_EQUIVALENTS = {
  CANDIDATE_ADMIN: ['CANDIDATE'],
  RECRUITER_ADMIN: ['ADMIN', 'RECRUITER'],
  PLATFORM_ADMIN: ['ADMIN'],
};

export function roleSatisfies(userRole, requiredRoles) {
  if (requiredRoles.includes(userRole)) return true;
  return (ROLE_EQUIVALENTS[userRole] || []).some((equivalent) => requiredRoles.includes(equivalent));
}

export function auth(requiredRoles = [], { allowPasswordChangeRequired = false } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        return res.status(401).json(apiError('Authentication required.'));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          recruiterProfile: { include: { organisation: true } },
          candidateProfile: true,
        },
      });

      if (!user || !user.isActive) {
        return res.status(401).json(apiError('User not found or inactive.'));
      }

      if (decoded.sessionVersion !== user.sessionVersion) {
        return res.status(401).json(apiError('Invalid or expired authentication token.'));
      }

      if (user.mustChangePassword && !allowPasswordChangeRequired) {
        return res.status(403).json(apiError('Password change required before continuing.', { code: 'PASSWORD_CHANGE_REQUIRED' }));
      }

      if (requiredRoles.length && !roleSatisfies(user.role, requiredRoles)) {
        return res.status(403).json(apiError('Insufficient permissions.'));
      }

      const requestedOrganisationId = getRequestOrganisationId(req);
      const { memberships, activeMembership } = await resolveMembershipForRequest(user, requestedOrganisationId);

      req.user = {
        ...user,
        memberships,
        activeMembership,
      };
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json(apiError('Invalid or expired authentication token.'));
      }
      next(error);
    }
  };
}
