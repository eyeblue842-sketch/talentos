import { z } from 'zod';
import {
  availabilityStatusSchema,
  employmentTypeSchema,
  notificationTypeSchema,
  workplaceTypeSchema,
} from './ats.js';

export const profileVisibilitySchema = z.enum([
  'PRIVATE',
  'RECRUITERS_ONLY',
  'PUBLIC',
]);

const stringArrayField = (maxItems = 20, maxLength = 80) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems));

export const candidateProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  headline: z.string().trim().min(2).max(160).optional().nullable(),
  currentTitle: z.string().trim().min(2).max(160).optional().nullable(),
  location: z.string().trim().min(2).max(160).optional().nullable(),
  totalExperience: z.coerce.number().int().min(0).max(60).optional(),
  skills: stringArrayField(50, 80).optional(),
  preferredRoles: stringArrayField(20, 120).optional(),
  preferredLocations: stringArrayField(20, 160).optional(),
  workplacePreferences: z.array(workplaceTypeSchema).max(3).optional(),
  employmentPreferences: z.array(employmentTypeSchema).max(4).optional(),
  availability: availabilityStatusSchema.optional(),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  currentCtcLpa: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  expectedCtcLpa: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  profileImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  linkedInUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  profileVisibility: profileVisibilitySchema.optional(),
}).refine((value) => {
  if (
    typeof value.currentCtcLpa === 'number'
    && typeof value.expectedCtcLpa === 'number'
    && value.currentCtcLpa > value.expectedCtcLpa
  ) {
    return false;
  }

  return true;
}, {
  message: 'Expected salary must be greater than or equal to current salary.',
  path: ['expectedCtcLpa'],
});

export const candidateSettingsUpdateSchema = z.object({
  profileVisibility: profileVisibilitySchema.optional(),
  recommendationEnabled: z.boolean().optional(),
  preferredLocations: stringArrayField(20, 160).optional(),
  workplacePreferences: z.array(workplaceTypeSchema).max(3).optional(),
  employmentPreferences: z.array(employmentTypeSchema).max(4).optional(),
  notifyForSavedJobUpdates: z.boolean().optional(),
  notifyForRecommendations: z.boolean().optional(),
  notifyForInterviews: z.boolean().optional(),
});

export const publicJobSearchQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).optional(),
  skills: stringArrayField(10, 80).optional(),
  location: z.string().trim().max(160).optional(),
  employmentType: z.array(employmentTypeSchema).optional().or(employmentTypeSchema.transform((value) => [value])),
  workplaceType: z.array(workplaceTypeSchema).optional().or(workplaceTypeSchema.transform((value) => [value])),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  maxExperience: z.coerce.number().int().min(0).max(60).optional(),
  salaryMin: z.coerce.number().int().min(0).max(1000000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(1000000).optional(),
  fresherFriendly: z.coerce.boolean().optional(),
  postedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  organisation: z.string().trim().max(120).optional(),
  organisationSlug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  sort: z.enum(['relevance', 'newest', 'oldest', 'salary_high']).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const savedJobCreateSchema = z.object({
  jobId: z.string().min(1),
});

export const notificationPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  type: notificationTypeSchema.optional(),
});

export const candidateNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

