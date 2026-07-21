import { z } from 'zod';

const passwordPolicyMessage = 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character.';

export const setupOrganisationSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companyLogoUrl: z.string().trim().url().max(500).optional().or(z.literal('')).transform((value) => value || undefined),
  industry: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(2).max(120),
  currency: z.string().trim().min(1).max(12),
  dateFormat: z.string().trim().min(2).max(32),
});

export const setupSuperAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  mobile: z.string().trim().min(6).max(32),
  password: z.string()
    .min(12, passwordPolicyMessage)
    .regex(/[A-Z]/, passwordPolicyMessage)
    .regex(/[a-z]/, passwordPolicyMessage)
    .regex(/[0-9]/, passwordPolicyMessage)
    .regex(/[^A-Za-z0-9]/, passwordPolicyMessage),
  confirmPassword: z.string(),
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  }
});

export const setupPreferencesSchema = z.object({
  language: z.string().trim().min(2).max(32),
  defaultMeetingProvider: z.enum(['CUSTOM', 'GOOGLE_MEET', 'ZOOM']),
  googleEnabled: z.boolean().optional().default(false),
  zoomEnabled: z.boolean().optional().default(false),
  emailProvider: z.string().trim().min(2).max(64),
  aiEnabled: z.boolean().optional().default(false),
  notificationPreferences: z.object({
    email: z.boolean().optional().default(true),
    inApp: z.boolean().optional().default(true),
  }).default({ email: true, inApp: true }),
});

export const initialSetupSubmitSchema = z.object({
  organisation: setupOrganisationSchema,
  superAdmin: setupSuperAdminSchema,
  preferences: setupPreferencesSchema,
});

export const initialSetupResetSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required.'),
});
