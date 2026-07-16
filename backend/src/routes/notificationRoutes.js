import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validateSchema } from '../middleware/schema.js';
import { notificationReadSchema } from '@careeriz/shared';
import { getNotifications, readNotifications } from '../controllers/notificationController.js';

export const notificationRouter = Router();

notificationRouter.get('/', auth(), getNotifications);
notificationRouter.post('/read', auth(), validateSchema(notificationReadSchema), readNotifications);
