import { z } from 'zod';

export const candidateProfileSourceSchema = z.enum([
  'DIRECT_SIGNUP',
  'GOOGLE_OAUTH',
  'BULK_IMPORT',
  'RECRUITER_CREATED',
  'ADMIN_CREATED',
]);

export const candidateProfileStatusSchema = z.enum([
  'IMPORTED',
  'REVIEW_REQUIRED',
  'INVITED',
  'ACTIVE',
  'ARCHIVED',
]);

export const resumeImportBatchStatusSchema = z.enum([
  'QUEUED',
  'UPLOADING',
  'UPLOADED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
]);

export const resumeImportItemStatusSchema = z.enum([
  'QUEUED',
  'UPLOADING',
  'UPLOADED',
  'EXTRACTING',
  'PARSING',
  'REVIEW_REQUIRED',
  'DUPLICATE',
  'READY',
  'IMPORTED',
  'FAILED',
  'CANCELLED',
]);

export const resumeImportDuplicateResolutionSchema = z.enum([
  'PENDING',
  'SKIPPED',
  'ATTACHED_TO_EXISTING',
  'UPDATE_EMPTY_FIELDS',
  'REPLACE_SELECTED_FIELDS',
  'CREATED_SEPARATE',
  'REJECTED',
]);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const resumeImportListQuerySchema = paginationSchema.extend({
  status: resumeImportBatchStatusSchema.optional(),
  createdByUserId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'completedAt']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const resumeImportItemListQuerySchema = paginationSchema.extend({
  status: resumeImportItemStatusSchema.optional(),
  reviewOnly: z.coerce.boolean().optional(),
  duplicateOnly: z.coerce.boolean().optional(),
  failedOnly: z.coerce.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'processingCompletedAt']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const resumeImportItemPatchSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phoneNumber: z.string().trim().min(7).max(30).optional().nullable().or(z.literal('')),
  linkedInUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  currentTitle: z.string().trim().max(160).optional().nullable(),
  currentEmployer: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  totalExperience: z.coerce.number().int().min(0).max(60).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  parsedData: z.record(z.string(), z.any()).optional(),
  reviewNotes: z.string().trim().max(1000).optional().nullable(),
  requiresManualReview: z.boolean().optional(),
});

export const resumeImportItemRetrySchema = z.object({
  force: z.boolean().optional(),
});

export const resumeImportBatchRetrySchema = z.object({
  includeReviewRequired: z.boolean().optional(),
});

export const resumeImportItemConfirmSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phoneNumber: z.string().trim().min(7).max(30).optional().nullable().or(z.literal('')),
  linkedInUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  currentTitle: z.string().trim().max(160).optional().nullable(),
  currentEmployer: z.string().trim().max(160).optional().nullable(),
  currentDesignation: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  currentCity: z.string().trim().max(120).optional().nullable(),
  currentState: z.string().trim().max(120).optional().nullable(),
  currentCountry: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(30).optional().nullable(),
  totalExperience: z.coerce.number().int().min(0).max(60).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  functionalSkills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  tools: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  frameworks: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  cloudPlatforms: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  databases: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  softSkills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  experienceEntries: z.array(z.record(z.string(), z.any())).max(200).optional(),
  educationEntries: z.array(z.record(z.string(), z.any())).max(200).optional(),
  certificationEntries: z.array(z.record(z.string(), z.any())).max(200).optional(),
  languageEntries: z.array(z.record(z.string(), z.any())).max(200).optional(),
  projectEntries: z.array(z.record(z.string(), z.any())).max(200).optional(),
  parserMetadata: z.record(z.string(), z.any()).optional(),
  provenanceMetadata: z.record(z.string(), z.any()).optional(),
});

export const resumeImportDuplicateResolutionInputSchema = z.object({
  resolution: resumeImportDuplicateResolutionSchema.exclude(['PENDING']),
  existingCandidateId: z.string().trim().min(1).optional(),
  fieldsToReplace: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  reviewNotes: z.string().trim().max(1000).optional().nullable(),
});

export const resumeImportItemRejectSchema = z.object({
  reviewNotes: z.string().trim().min(1).max(1000),
});
