import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  ELASTICSEARCH_ENABLED: z.enum(['true', 'false']).default('false'),
  ELASTICSEARCH_URL: z.string().url().optional(),
  ELASTICSEARCH_INDEX: z.string().default('resumes'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./storage/resumes'),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default('no-reply@careeriz.app'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
}).superRefine((data, context) => {
  if (data.ELASTICSEARCH_ENABLED === 'true' && !data.ELASTICSEARCH_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ELASTICSEARCH_URL'],
      message: 'ELASTICSEARCH_URL is required when ELASTICSEARCH_ENABLED=true.',
    });
  }
});

export function parseEnv(rawEnv) {
  return envSchema.safeParse(rawEnv);
}

const parsed = parseEnv(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Environment validation failed: ${issues}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test'
    || process.argv.some((arg) => arg.includes('node:test') || arg === '--test')
    || process.execArgv.includes('--test'),
  port: parsed.data.PORT,
  frontendUrl: parsed.data.FRONTEND_URL,
  backendUrl: parsed.data.BACKEND_URL || `http://localhost:${parsed.data.PORT}`,
  databaseUrl: parsed.data.DATABASE_URL,
  directUrl: parsed.data.DIRECT_URL || parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  elasticsearchEnabled: parsed.data.ELASTICSEARCH_ENABLED === 'true',
  elasticsearchUrl: parsed.data.ELASTICSEARCH_URL,
  elasticsearchIndex: parsed.data.ELASTICSEARCH_INDEX,
  storageProvider: parsed.data.STORAGE_PROVIDER,
  localStoragePath: parsed.data.LOCAL_STORAGE_PATH,
  awsRegion: parsed.data.AWS_REGION,
  awsBucket: parsed.data.AWS_S3_BUCKET,
  awsAccessKeyId: parsed.data.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsed.data.AWS_SECRET_ACCESS_KEY,
  smtpHost: parsed.data.SMTP_HOST,
  smtpPort: parsed.data.SMTP_PORT,
  smtpUser: parsed.data.SMTP_USER,
  smtpPass: parsed.data.SMTP_PASS,
  emailFrom: parsed.data.EMAIL_FROM,
  passwordResetTtlMinutes: parsed.data.PASSWORD_RESET_TTL_MINUTES,
  emailVerificationTtlHours: parsed.data.EMAIL_VERIFICATION_TTL_HOURS,
  rateLimitWindowMinutes: parsed.data.RATE_LIMIT_WINDOW_MINUTES,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID,
  googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: parsed.data.GOOGLE_REDIRECT_URI,
  linkedinClientId: parsed.data.LINKEDIN_CLIENT_ID,
  linkedinClientSecret: parsed.data.LINKEDIN_CLIENT_SECRET,
  linkedinRedirectUri: parsed.data.LINKEDIN_REDIRECT_URI,
};
