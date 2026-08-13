import { z } from 'zod';

export const directMessageTypeSchema = z.enum([
  'TEXT',
  'FILE',
  'IMAGE',
]);

export const messagingPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const conversationListQuerySchema = messagingPaginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
});

export const conversationCreateSchema = z.object({
  participantUserId: z.string().min(1),
});

export const conversationReadSchema = z.object({
  lastReadMessageId: z.string().min(1).optional(),
});

export const conversationMessagesQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const messageSendSchema = z.object({
  content: z.string().trim().max(5000).optional().nullable(),
}).superRefine((value, ctx) => {
  if (!value.content) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Message content is required when no attachment is provided.',
      path: ['content'],
    });
  }
});
