import { prisma } from '../config/db.js';
import { serializeAuditLog } from '../serializers/index.js';

const sensitiveKeys = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'jwt',
  'resetToken',
  'verificationToken',
  'secret',
]);

function scrub(value) {
  if (Array.isArray(value)) {
    return value.map(scrub);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKeys.has(key))
      .map(([key, entry]) => [key, scrub(entry)])
  );
}

// `client` defaults to the shared prisma singleton but may be a
// transaction handle (`tx`) so the audit write commits atomically with the
// state change it records (domain-ownership closure section 4).
export async function recordAuditLog(payload, client = prisma) {
  const log = await client.auditLog.create({
    data: {
      organisationId: payload.organisationId || null,
      actorUserId: payload.actorUserId || null,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId || null,
      beforeData: scrub(payload.beforeData),
      afterData: scrub(payload.afterData),
      metadata: scrub(payload.metadata),
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
    },
  });

  return serializeAuditLog(log);
}

export async function listAuditLogsForOrganisation(organisationId) {
  const logs = await prisma.auditLog.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return logs.map(serializeAuditLog);
}
