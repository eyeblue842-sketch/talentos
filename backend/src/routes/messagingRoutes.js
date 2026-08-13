import multer from 'multer';
import {
  conversationCreateSchema,
  conversationListQuerySchema,
  conversationMessagesQuerySchema,
  conversationReadSchema,
} from '@careeriz/shared';
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateSchema } from '../middleware/schema.js';
import {
  downloadAttachment,
  getConversation,
  getConversationMessages,
  getConversations,
  getUnreadCount,
  postConversation,
  postConversationMessage,
  postConversationRead,
} from '../controllers/messagingController.js';

export const messagingRouter = Router();

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MESSAGE_ATTACHMENT_MAX_MB || 10) * 1024 * 1024,
    files: 1,
  },
});

const conversationCreateRateLimiter = createRateLimiter({
  keyPrefix: 'messages-conversation-create',
  limit: Number(process.env.MESSAGE_CONVERSATION_CREATE_RATE_LIMIT || 60),
  windowMinutes: Number(process.env.MESSAGE_CONVERSATION_CREATE_WINDOW_MINUTES || 60),
  keyResolver: (req) => req.user?.id || req.ip,
});

const messageSendRateLimiter = createRateLimiter({
  keyPrefix: 'messages-send',
  limit: Number(process.env.MESSAGE_SEND_RATE_LIMIT || 120),
  windowMinutes: Number(process.env.MESSAGE_SEND_WINDOW_MINUTES || 60),
  keyResolver: (req) => req.user?.id || req.ip,
});

messagingRouter.use(auth(['CANDIDATE', 'CANDIDATE_ADMIN', 'RECRUITER', 'RECRUITER_ADMIN']));

messagingRouter.get('/conversations', validateSchema(conversationListQuerySchema, 'query'), getConversations);
messagingRouter.post('/conversations', conversationCreateRateLimiter, validateSchema(conversationCreateSchema), postConversation);
messagingRouter.get('/conversations/:conversationId', getConversation);
messagingRouter.get('/conversations/:conversationId/messages', validateSchema(conversationMessagesQuerySchema, 'query'), getConversationMessages);
messagingRouter.post('/conversations/:conversationId/messages', messageSendRateLimiter, attachmentUpload.single('attachment'), postConversationMessage);
messagingRouter.post('/conversations/:conversationId/read', validateSchema(conversationReadSchema), postConversationRead);
messagingRouter.get('/unread-count', getUnreadCount);
messagingRouter.get('/attachments/:messageId', downloadAttachment);
