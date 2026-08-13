import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '../config/db.js';
import { readPrivateFileNodeStream, storePrivateFile } from '../config/storage.js';
import { createNotification } from './notificationService.js';

const DEFAULT_CONVERSATION_PAGE_SIZE = 20;
const DEFAULT_MESSAGE_LIMIT = 25;
const MAX_MESSAGE_LIMIT = 100;
const MAX_ATTACHMENT_BYTES = Number(process.env.MESSAGE_ATTACHMENT_MAX_MB || 10) * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Map([
  ['.pdf', { category: 'FILE', mimeTypes: new Set(['application/pdf']) }],
  ['.doc', { category: 'FILE', mimeTypes: new Set(['application/msword']) }],
  ['.docx', { category: 'FILE', mimeTypes: new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']) }],
  ['.png', { category: 'IMAGE', mimeTypes: new Set(['image/png']) }],
  ['.jpg', { category: 'IMAGE', mimeTypes: new Set(['image/jpeg']) }],
  ['.jpeg', { category: 'IMAGE', mimeTypes: new Set(['image/jpeg']) }],
  ['.webp', { category: 'IMAGE', mimeTypes: new Set(['image/webp']) }],
  ['.gif', { category: 'IMAGE', mimeTypes: new Set(['image/gif']) }],
]);

function createHttpError(message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function buildPairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(':');
}

function titleCaseFromEmail(email) {
  const localPart = String(email || '').split('@')[0];
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Careeriz Professional';
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function summarizeParticipant(user) {
  const candidate = user.candidateProfile || null;
  const recruiter = user.recruiterProfile || null;
  const organisation = recruiter?.organisation || null;

  return {
    userId: user.id,
    role: user.role,
    fullName: candidate?.fullName || user.name || titleCaseFromEmail(user.email),
    headline: candidate?.headline || candidate?.currentTitle || recruiter?.designation || recruiter?.industryDomain || null,
    designation: candidate?.currentDesignation || candidate?.currentTitle || recruiter?.designation || null,
    company: candidate?.currentEmployer || recruiter?.companyName || organisation?.name || null,
    location: candidate?.location || recruiter?.headquartersLocation || organisation?.headquarters || null,
    profilePhoto: candidate?.profileImageUrl || null,
    profilePath: `/network/people/${user.id}`,
  };
}

function sanitizeMessagePreview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 180) || null;
}

async function findActiveUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      candidateProfile: true,
      recruiterProfile: {
        include: { organisation: true },
      },
    },
  });

  if (!user || !user.isActive) {
    throw createHttpError('User not found.', 404);
  }

  return user;
}

async function getBlockRecord(userIdA, userIdB) {
  return prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userIdA, blockedUserId: userIdB },
        { blockerUserId: userIdB, blockedUserId: userIdA },
      ],
    },
  });
}

async function getAcceptedConnection(userIdA, userIdB) {
  return prisma.userConnection.findUnique({
    where: { pairKey: buildPairKey(userIdA, userIdB) },
  });
}

async function assertMessagingAllowedBetween(userIdA, userIdB) {
  if (userIdA === userIdB) {
    throw createHttpError('You cannot message yourself.', 422);
  }

  const block = await getBlockRecord(userIdA, userIdB);
  if (block) {
    throw createHttpError('Messaging is unavailable for this user.', 403);
  }

  const connection = await getAcceptedConnection(userIdA, userIdB);
  if (!connection || connection.status !== 'ACCEPTED') {
    throw createHttpError('An accepted Careeriz connection is required before messaging.', 403);
  }

  return connection;
}

async function getConversationForUser(userId, conversationId) {
  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { participantAUserId: userId },
        { participantBUserId: userId },
      ],
    },
    include: {
      participantAUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
      participantBUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw createHttpError('Conversation not found.', 404);
  }

  return conversation;
}

function getCounterpart(conversation, actorUserId) {
  return conversation.participantAUserId === actorUserId
    ? conversation.participantBUser
    : conversation.participantAUser;
}

function getUnreadCount(conversation, actorUserId) {
  return conversation.participantAUserId === actorUserId
    ? conversation.participantAUnreadCount
    : conversation.participantBUnreadCount;
}

function buildConversationSummary(conversation, actorUserId) {
  const counterpart = getCounterpart(conversation, actorUserId);
  return {
    id: conversation.id,
    participant: summarizeParticipant(counterpart),
    createdAt: iso(conversation.createdAt),
    updatedAt: iso(conversation.updatedAt),
    lastMessageAt: iso(conversation.lastMessageAt),
    lastMessagePreview: conversation.lastMessagePreview || null,
    unreadCount: getUnreadCount(conversation, actorUserId),
    canSend: true,
  };
}

function buildMessageResponse(message, actorUserId) {
  const isAttachment = Boolean(message.attachmentStorageKey);
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    isOwn: message.senderUserId === actorUserId,
    type: message.type,
    content: message.deletedAt ? null : (message.content || null),
    deleted: Boolean(message.deletedAt),
    createdAt: iso(message.createdAt),
    updatedAt: iso(message.updatedAt),
    editedAt: iso(message.editedAt),
    deletedAt: iso(message.deletedAt),
    attachment: isAttachment ? {
      filename: message.attachmentOriginalName,
      mimeType: message.attachmentMimeType,
      sizeBytes: message.attachmentSizeBytes,
      downloadUrl: `/api/messages/attachments/${message.id}`,
    } : null,
  };
}

function buildConversationSearchWhere(actorUserId, query) {
  if (!query) return {};

  const search = {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { candidateProfile: { fullName: { contains: query, mode: 'insensitive' } } },
      { candidateProfile: { currentTitle: { contains: query, mode: 'insensitive' } } },
      { candidateProfile: { currentDesignation: { contains: query, mode: 'insensitive' } } },
      { candidateProfile: { currentEmployer: { contains: query, mode: 'insensitive' } } },
      { recruiterProfile: { designation: { contains: query, mode: 'insensitive' } } },
      { recruiterProfile: { companyName: { contains: query, mode: 'insensitive' } } },
      { recruiterProfile: { organisation: { name: { contains: query, mode: 'insensitive' } } } },
    ],
  };

  return {
    OR: [
      {
        participantAUserId: actorUserId,
        participantBUser: search,
      },
      {
        participantBUserId: actorUserId,
        participantAUser: search,
      },
    ],
  };
}

async function validateAttachment(file) {
  if (!file) return null;
  if (!file.buffer?.length) {
    throw createHttpError('Attachment payload is empty.', 422);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw createHttpError('Attachment exceeds the allowed size.', 422);
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowed = ALLOWED_ATTACHMENT_TYPES.get(extension);
  if (!allowed) {
    throw createHttpError('Unsupported attachment type.', 422);
  }

  const detected = await fileTypeFromBuffer(file.buffer).catch(() => null);
  if (detected?.mime && !allowed.mimeTypes.has(detected.mime) && detected.mime !== 'application/zip') {
    throw createHttpError('Attachment content does not match its file type.', 422);
  }

  if (file.mimetype && !allowed.mimeTypes.has(file.mimetype)) {
    if (!(extension === '.docx' && file.mimetype === 'application/zip')) {
      throw createHttpError('Attachment MIME type is not allowed.', 422);
    }
  }

  return {
    category: allowed.category,
  };
}

function normalizeMessageInput(content, file) {
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!normalizedContent && !file) {
    throw createHttpError('Message content is required when no attachment is provided.', 422);
  }
  return normalizedContent;
}

export async function createOrGetDirectConversation(actorUser, participantUserId) {
  const target = await findActiveUser(participantUserId);
  await assertMessagingAllowedBetween(actorUser.id, target.id);

  const pairKey = buildPairKey(actorUser.id, target.id);
  const participantAUserId = actorUser.id < target.id ? actorUser.id : target.id;
  const participantBUserId = actorUser.id < target.id ? target.id : actorUser.id;

  const conversation = await prisma.directConversation.upsert({
    where: { pairKey },
    update: {},
    create: {
      pairKey,
      participantAUserId,
      participantBUserId,
    },
    include: {
      participantAUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
      participantBUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
    },
  });

  return buildConversationSummary(conversation, actorUser.id);
}

export async function listDirectConversations(actorUser, query = {}) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || DEFAULT_CONVERSATION_PAGE_SIZE), 1), 100);
  const page = Math.max(Number(query.page || 1), 1);
  const where = {
    AND: [
      {
        OR: [
          { participantAUserId: actorUser.id },
          { participantBUserId: actorUser.id },
        ],
      },
      buildConversationSearchWhere(actorUser.id, String(query.q || '').trim()),
    ],
  };

  const total = await prisma.directConversation.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  const conversations = await prisma.directConversation.findMany({
    where,
    include: {
      participantAUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
      participantBUser: {
        include: {
          candidateProfile: true,
          recruiterProfile: { include: { organisation: true } },
        },
      },
    },
    orderBy: [
      { lastMessageAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: conversations.map((item) => buildConversationSummary(item, actorUser.id)),
    meta: {
      total,
      page: currentPage,
      pageSize,
      pageCount,
    },
  };
}

export async function getDirectConversation(actorUser, conversationId) {
  const conversation = await getConversationForUser(actorUser.id, conversationId);
  const otherUserId = getCounterpart(conversation, actorUser.id).id;
  const connection = await getAcceptedConnection(actorUser.id, otherUserId);
  const blocked = await getBlockRecord(actorUser.id, otherUserId);

  return {
    ...buildConversationSummary(conversation, actorUser.id),
    canSend: Boolean(connection?.status === 'ACCEPTED' && !blocked),
  };
}

export async function listDirectMessages(actorUser, conversationId, query = {}) {
  const conversation = await getConversationForUser(actorUser.id, conversationId);
  const limit = Math.min(Math.max(Number(query.limit || DEFAULT_MESSAGE_LIMIT), 1), MAX_MESSAGE_LIMIT);
  const cursor = query.cursor ? String(query.cursor) : null;

  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId: conversation.id,
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const slice = hasMore ? messages.slice(0, limit) : messages;
  const ordered = [...slice].reverse();

  return {
    items: ordered.map((message) => buildMessageResponse(message, actorUser.id)),
    meta: {
      limit,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    },
  };
}

export async function sendDirectMessage(actorUser, conversationId, { content, file }) {
  const conversation = await getConversationForUser(actorUser.id, conversationId);
  const counterpart = getCounterpart(conversation, actorUser.id);
  await assertMessagingAllowedBetween(actorUser.id, counterpart.id);

  const normalizedContent = normalizeMessageInput(content, file);
  const attachmentInfo = await validateAttachment(file);
  const now = new Date();
  const preview = attachmentInfo
    ? `${attachmentInfo.category === 'IMAGE' ? 'Image' : 'File'}: ${file.originalname}`
    : sanitizeMessagePreview(normalizedContent);

  let stored = null;
  if (file) {
    stored = await storePrivateFile(file, {
      prefix: 'messages',
      metadata: {
        conversationId: conversation.id,
        senderUserId: actorUser.id,
      },
    });
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: actorUser.id,
        type: attachmentInfo?.category || 'TEXT',
        content: normalizedContent || null,
        attachmentOriginalName: stored?.originalFilename || null,
        attachmentStorageKey: stored?.storageKey || null,
        attachmentStorageProvider: stored?.storageProvider || null,
        attachmentMimeType: stored?.mimeType || null,
        attachmentSizeBytes: stored?.sizeBytes || null,
        attachmentChecksumSha256: stored?.checksumSha256 || null,
      },
    });

    await tx.directConversation.update({
      where: { id: conversation.id },
      data: conversation.participantAUserId === actorUser.id
        ? {
            lastMessageAt: now,
            lastMessagePreview: preview,
            participantALastReadAt: now,
            participantBUnreadCount: { increment: 1 },
          }
        : {
            lastMessageAt: now,
            lastMessagePreview: preview,
            participantBLastReadAt: now,
            participantAUnreadCount: { increment: 1 },
          },
    });

    return created;
  });

  await createNotification({
    organisationId: counterpart.activeMembership?.organisationId || actorUser.activeMembership?.organisationId || null,
    recipientUserId: counterpart.id,
    type: 'MESSAGE',
    title: `${summarizeParticipant(actorUser).fullName} sent you a message.`,
    message: preview || 'Open Careeriz Messages to view the conversation.',
    entityType: 'DirectConversation',
    entityId: conversation.id,
    metadata: {
      conversationId: conversation.id,
      senderUserId: actorUser.id,
    },
  }).catch(() => null);

  return buildMessageResponse(message, actorUser.id);
}

export async function markConversationRead(actorUser, conversationId, lastReadMessageId = null) {
  const conversation = await getConversationForUser(actorUser.id, conversationId);
  const where = lastReadMessageId
    ? {
        id: lastReadMessageId,
        conversationId: conversation.id,
      }
    : null;
  const targetMessage = where ? await prisma.directMessage.findFirst({ where }) : null;
  const now = targetMessage?.createdAt || new Date();

  await prisma.directConversation.update({
    where: { id: conversation.id },
    data: conversation.participantAUserId === actorUser.id
      ? {
          participantALastReadAt: now,
          participantAUnreadCount: 0,
        }
      : {
          participantBLastReadAt: now,
          participantBUnreadCount: 0,
        },
  });

  return { conversationId: conversation.id, readAt: iso(now) };
}

export async function getDirectUnreadCount(actorUser) {
  const aggregate = await prisma.directConversation.aggregate({
    where: {
      OR: [
        { participantAUserId: actorUser.id },
        { participantBUserId: actorUser.id },
      ],
    },
    _sum: {
      participantAUnreadCount: true,
      participantBUnreadCount: true,
    },
  });

  const conversations = await prisma.directConversation.findMany({
    where: {
      OR: [
        { participantAUserId: actorUser.id },
        { participantBUserId: actorUser.id },
      ],
    },
    select: {
      participantAUserId: true,
      participantAUnreadCount: true,
      participantBUserId: true,
      participantBUnreadCount: true,
    },
  });

  const unreadCount = conversations.reduce((sum, item) => sum + (
    item.participantAUserId === actorUser.id ? item.participantAUnreadCount : item.participantBUnreadCount
  ), 0);

  return {
    unreadCount,
    totalConversationCount: conversations.length,
    _aggregate: aggregate._sum,
  };
}

export async function getMessageAttachment(actorUser, messageId) {
  const message = await prisma.directMessage.findFirst({
    where: { id: messageId },
    include: {
      conversation: true,
    },
  });

  if (!message || !message.conversation) {
    throw createHttpError('Attachment not found.', 404);
  }

  if (message.conversation.participantAUserId !== actorUser.id && message.conversation.participantBUserId !== actorUser.id) {
    throw createHttpError('Attachment not found.', 404);
  }

  if (!message.attachmentStorageKey || !message.attachmentStorageProvider) {
    throw createHttpError('Attachment not found.', 404);
  }

  try {
    return {
      message: buildMessageResponse(message, actorUser.id),
      file: await readPrivateFileNodeStream(message.attachmentStorageProvider, message.attachmentStorageKey),
    };
  } catch {
    throw createHttpError('Attachment not found.', 404);
  }
}
