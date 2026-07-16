import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { apiError } from '../utils/response.js';
import { getRequestOrganisationId, resolveMembershipForRequest } from '../services/organisationAccessService.js';

export function auth(requiredRoles = []) {
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

      if (requiredRoles.length && !requiredRoles.includes(user.role)) {
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
