import { z } from 'zod';

export const userRoleSchema = z.enum([
  'RECRUITER',
  'CANDIDATE',
  'ADMIN',
  'CANDIDATE_ADMIN',
  'RECRUITER_ADMIN',
  'PLATFORM_ADMIN',
]);
export const signupUserRoleSchema = z.enum(['RECRUITER', 'CANDIDATE']);
export const oauthProviderSchema = z.enum(['google', 'linkedin']);

// CAREERIZ EMPLOYER ACCESS: which card the recruiter selected on the
// employer-access page. This only decides which server-side domain policy
// runs (see domainPolicyService.js) - it never directly sets an
// organisation's stored type, so submitting a mismatched value here is
// rejected by the domain check rather than trusted.
export const employerTypeSchema = z.enum(['CONSULTANCY', 'COMPANY']);

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: signupUserRoleSchema.optional(),
  employerType: employerTypeSchema.optional(),
  companyName: z.string().trim().min(1).max(160).optional(),
  website: z.string().trim().url().optional().or(z.literal('')),
  fullName: z.string().trim().min(1).optional(),
  location: z.string().trim().optional(),
  totalExperience: z.coerce.number().int().min(0).max(50).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// audience/employerType/next describe which portal initiated the reset
// (candidate vs employer, and for employer which recruiter type, plus a
// safe post-login destination) so the emailed OTP flow can send the user
// back to the correct portal-specific login once the reset is complete.
// They are optional and non-enumerating-safe: the backend never echoes
// whether the email exists, only records this context against the issued
// token when it does.
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
  audience: z.enum(['candidate', 'employer']).optional(),
  employerType: employerTypeSchema.optional(),
  next: z.string().trim().min(1).max(2048).optional(),
});

export const tokenConfirmationSchema = z.object({
  token: z.string().min(32),
});

export const passwordResetOtpVerifySchema = z.object({
  token: z.string().min(32),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export const oauthCallbackSchema = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1),
  state: z.string().min(32),
});

export const passwordResetConfirmSchema = tokenConfirmationSchema.extend({
  password: z.string().min(8).max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  mustChangePassword: z.boolean().optional(),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  expiresAt: z.string(),
});
