import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';

export function auth(requiredRoles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;

      if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { recruiterProfile: true, candidateProfile: true },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'User not found or inactive.' });
      }

      if (requiredRoles.length && !requiredRoles.includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
