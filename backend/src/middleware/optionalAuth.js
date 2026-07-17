import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { resolveMembershipForRequest, getRequestOrganisationId } from '../services/organisationAccessService.js';

export function optionalAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        return next();
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          recruiterProfile: { include: { organisation: true } },
          candidateProfile: true,
        },
      });

      if (!user || !user.isActive || decoded.sessionVersion !== user.sessionVersion) {
        return next();
      }

      const requestedOrganisationId = getRequestOrganisationId(req);
      const { memberships, activeMembership } = await resolveMembershipForRequest(user, requestedOrganisationId);
      req.user = {
        ...user,
        memberships,
        activeMembership,
      };

      next();
    } catch {
      next();
    }
  };
}
