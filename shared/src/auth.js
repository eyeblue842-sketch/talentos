import { z } from 'zod';

export const userRoleSchema = z.enum(['RECRUITER', 'CANDIDATE', 'ADMIN']);
export const signupUserRoleSchema = z.enum(['RECRUITER', 'CANDIDATE']);
export const oauthProviderSchema = z.enum(['google', 'linkedin']);

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: signupUserRoleSchema.optional(),
  fullName: z.string().trim().min(1).optional(),
  location: z.string().trim().optional(),
  totalExperience: z.coerce.number().int().min(0).max(50).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const tokenConfirmationSchema = z.object({
  token: z.string().min(32),
});

export const oauthCallbackSchema = z.object({
  provider: oauthProviderSchema,
  code: z.string().min(1),
  state: z.string().min(32),
});

export const passwordResetConfirmSchema = tokenConfirmationSchema.extend({
  password: z.string().min(8).max(72),
});

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  isActive: z.boolean(),
  emailVerified: z.boolean(),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  expiresAt: z.string(),
});
