import { z } from 'zod';

export const connectionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'BLOCKED',
]);

export const connectionSourceSchema = z.enum([
  'PROFILE',
  'PEOPLE_SEARCH',
  'JOB',
  'COMPANY',
  'SUGGESTION',
  'MUTUAL_CONNECTION',
]);

export const connectionRequestPermissionSchema = z.enum([
  'EVERYONE',
  'RECRUITERS_ONLY',
  'NOBODY',
]);

export const connectionVisibilitySchema = z.enum([
  'EVERYONE',
  'CONNECTIONS_ONLY',
  'NOBODY',
]);

export const networkPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const networkRequestCreateSchema = z.object({
  targetUserId: z.string().min(1),
  source: connectionSourceSchema.optional(),
});

export const networkRequestActionSchema = z.object({
  requestId: z.string().min(1),
});

export const networkConnectionDeleteSchema = z.object({
  connectionId: z.string().min(1),
});

export const networkBlockUserSchema = z.object({
  userId: z.string().min(1),
});

export const networkMutualQuerySchema = networkPaginationQuerySchema.extend({
  userId: z.string().min(1).optional(),
});

export const peopleSearchQuerySchema = networkPaginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  name: z.string().trim().max(120).optional(),
  designation: z.string().trim().max(120).optional(),
  skills: z.preprocess((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }, z.array(z.string().trim().min(1).max(80)).max(20).optional()),
  domain: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  currentCompany: z.string().trim().max(120).optional(),
  previousCompany: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  education: z.string().trim().max(120).optional(),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  maxExperience: z.coerce.number().int().min(0).max(60).optional(),
  role: z.enum(['CANDIDATE', 'RECRUITER']).optional(),
  connectionState: connectionStatusSchema.optional(),
});

export const networkSuggestionQuerySchema = networkPaginationQuerySchema.extend({
  refresh: z.coerce.boolean().optional(),
});

export const companyFollowSchema = z.object({
  organisationId: z.string().min(1),
});

export const networkPrivacyUpdateSchema = z.object({
  allowConnectionRequestsFrom: connectionRequestPermissionSchema.optional(),
  connectionVisibility: connectionVisibilitySchema.optional(),
  showInPeopleSearch: z.boolean().optional(),
  showRecruiterIdentity: z.boolean().optional(),
});
