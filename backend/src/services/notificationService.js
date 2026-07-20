import { prisma } from '../config/db.js';
import { serializeNotification } from '../serializers/index.js';

export async function createNotification(payload) {
  const notification = await prisma.notification.create({
    data: {
      organisationId: payload.organisationId || null,
      recipientUserId: payload.recipientUserId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entityType: payload.entityType || null,
      entityId: payload.entityId || null,
      metadata: payload.metadata || null,
    },
  });

  return serializeNotification(notification);
}

export async function listNotifications(userId, organisationId = null) {
  const notifications = await prisma.notification.findMany({
    where: {
      recipientUserId: userId,
      organisationId: organisationId || undefined,
    },
    orderBy: { createdAt: 'desc' },
  });

  return notifications.map(serializeNotification);
}

export async function markNotificationsRead(userId, notificationIds) {
  await prisma.notification.updateMany({
    where: {
      recipientUserId: userId,
      id: { in: notificationIds },
    },
    data: { readAt: new Date() },
  });

  return listNotifications(userId);
}
