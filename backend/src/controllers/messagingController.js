import {
  createOrGetDirectConversation,
  getDirectConversation,
  getDirectUnreadCount,
  getMessageAttachment,
  listDirectConversations,
  listDirectMessages,
  markConversationRead,
  sendDirectMessage,
} from '../services/messagingService.js';
import { sendSuccess } from '../utils/response.js';

function pipeDownload(res, filename, mimeType, contentLength, stream, next) {
  if (mimeType) res.setHeader('Content-Type', mimeType);
  if (contentLength) res.setHeader('Content-Length', String(contentLength));
  res.setHeader('Content-Disposition', `attachment; filename="${String(filename || 'attachment').replace(/"/g, '')}"`);
  stream.once('error', (error) => {
    if (!res.headersSent) {
      const downloadError = new Error(error?.code === 'ENOENT' ? 'Attachment not found.' : 'Unable to read attachment.');
      downloadError.statusCode = error?.code === 'ENOENT' ? 404 : 500;
      next(downloadError);
      return;
    }

    res.destroy(error);
  });
  stream.pipe(res);
}

export async function postConversation(req, res, next) {
  try {
    const result = await createOrGetDirectConversation(req.user, req.body.participantUserId);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getConversations(req, res, next) {
  try {
    const result = await listDirectConversations(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getConversation(req, res, next) {
  try {
    const result = await getDirectConversation(req.user, req.params.conversationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(req, res, next) {
  try {
    const result = await listDirectMessages(req.user, req.params.conversationId, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function postConversationMessage(req, res, next) {
  try {
    const result = await sendDirectMessage(req.user, req.params.conversationId, {
      content: req.body?.content,
      file: req.file || null,
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function postConversationRead(req, res, next) {
  try {
    const result = await markConversationRead(req.user, req.params.conversationId, req.body?.lastReadMessageId || null);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const result = await getDirectUnreadCount(req.user);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachment(req, res, next) {
  try {
    const result = await getMessageAttachment(req.user, req.params.messageId);
    pipeDownload(
      res,
      result.message.attachment?.filename,
      result.message.attachment?.mimeType,
      result.message.attachment?.sizeBytes,
      result.file.stream,
      next,
    );
  } catch (error) {
    next(error);
  }
}
