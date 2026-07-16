import { listNotifications, markNotificationsRead } from '../services/notificationService.js';
import { sendSuccess } from '../utils/response.js';

export async function getNotifications(req, res, next) {
  try {
    const notifications = await listNotifications(req.user.id, req.user.activeMembership?.organisationId || null);
    sendSuccess(res, 200, notifications);
  } catch (error) {
    next(error);
  }
}

export async function readNotifications(req, res, next) {
  try {
    const notifications = await markNotificationsRead(req.user.id, req.body.notificationIds);
    sendSuccess(res, 200, notifications);
  } catch (error) {
    next(error);
  }
}
