import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  API_BODY_LIMIT_MB: z.coerce.number().int().min(1).max(50).default(5),
  FILE_UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(100).default(5),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  ELASTICSEARCH_ENABLED: z.enum(['true', 'false']).default('false'),
  ELASTICSEARCH_URL: z.string().url().optional(),
  ELASTICSEARCH_INDEX: z.string().default('resumes'),
  REDIS_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_URL: z.string().url().optional(),
  REDIS_KEY_PREFIX: z.string().default('careeriz'),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./storage/resumes'),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().url().optional(),
  AWS_S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  QUEUE_PROVIDER: z.enum(['database', 'sqs']).default('database'),
  AWS_SQS_RESUME_IMPORT_QUEUE_URL: z.string().url().optional(),
  AWS_SQS_RESUME_IMPORT_DLQ_URL: z.string().url().optional(),
  RESUME_IMPORT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  RESUME_IMPORT_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  RESUME_IMPORT_MAX_FILES: z.coerce.number().int().min(1).max(1000).default(100),
  RESUME_MAX_FILE_SIZE_MB: z.coerce.number().int().min(1).max(100).default(10),
  RESUME_IMPORT_MAX_ZIP_SIZE_MB: z.coerce.number().int().min(1).max(1000).default(100),
  RESUME_IMPORT_MAX_UNCOMPRESSED_MB: z.coerce.number().int().min(1).max(5000).default(500),
  RESUME_IMPORT_MAX_TEXT_CHARS: z.coerce.number().int().min(1000).max(1000000).default(120000),
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
  GOOGLE_MEETING_ENABLED: z.enum(['true', 'false']).default('false'),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  ZOOM_MEETING_ENABLED: z.enum(['true', 'false']).default('false'),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_OAUTH_REDIRECT_URI: z.string().url().optional(),
  CUSTOM_MEETING_ENABLED: z.enum(['true', 'false']).default('true'),
  PUBLIC_APP_URL: z.string().url().optional(),
  MEETING_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  RESUME_BUILDER_ENABLED: z.enum(['true', 'false']).default('false'),
  RESUME_BUILDER_BASE_URL: z.string().url().optional(),
  RESUME_BUILDER_CLIENT_ID: z.string().optional(),
  INTELLIGENCE_ENABLED: z.enum(['true', 'false']).default('false'),
  INTELLIGENCE_PROVIDER: z.enum(['DISABLED', 'MOCK', 'BEDROCK', 'OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'OLLAMA', 'CUSTOM_OPENAI_COMPATIBLE']).default('DISABLED'),
  INTELLIGENCE_MODEL: z.string().trim().min(1).max(200).optional(),
  INTELLIGENCE_API_KEY: z.string().trim().min(1).optional(),
  INTELLIGENCE_BASE_URL: z.string().url().optional(),
  INTELLIGENCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  INTELLIGENCE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  INTELLIGENCE_MAX_INPUT_CHARS: z.coerce.number().int().min(500).max(200000).default(30000),
  INTELLIGENCE_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(8000).default(1200),
  AI_PROVIDER: z.enum(['disabled', 'mock', 'bedrock']).default('disabled'),
  AI_RESUME_PARSING_ENABLED: z.enum(['true', 'false']).default('false'),
  AWS_BEDROCK_REGION: z.string().optional(),
  AWS_BEDROCK_MODEL_ID: z.string().optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  WORKER_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  TASK_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
}).superRefine((data, context) => {
  if (data.ELASTICSEARCH_ENABLED === 'true' && !data.ELASTICSEARCH_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ELASTICSEARCH_URL'],
      message: 'ELASTICSEARCH_URL is required when ELASTICSEARCH_ENABLED=true.',
    });
  }

  if (data.RESUME_BUILDER_ENABLED === 'true' && !data.RESUME_BUILDER_BASE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESUME_BUILDER_BASE_URL'],
      message: 'RESUME_BUILDER_BASE_URL is required when RESUME_BUILDER_ENABLED=true.',
    });
  }

  const intelligenceEnabled = data.INTELLIGENCE_ENABLED === 'true';
  const providerEnabled = data.INTELLIGENCE_PROVIDER !== 'DISABLED';

  if (intelligenceEnabled && !data.INTELLIGENCE_MODEL && !['MOCK'].includes(data.INTELLIGENCE_PROVIDER)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTELLIGENCE_MODEL'],
      message: 'INTELLIGENCE_MODEL is required when intelligence is enabled.',
    });
  }

  if (providerEnabled && !['MOCK', 'BEDROCK'].includes(data.INTELLIGENCE_PROVIDER) && !data.INTELLIGENCE_BASE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTELLIGENCE_BASE_URL'],
      message: 'INTELLIGENCE_BASE_URL is required for non-disabled providers.',
    });
  }

  if (providerEnabled && !['MOCK', 'BEDROCK', 'OLLAMA'].includes(data.INTELLIGENCE_PROVIDER) && !data.INTELLIGENCE_API_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTELLIGENCE_API_KEY'],
      message: 'INTELLIGENCE_API_KEY is required for the configured provider.',
    });
  }

  if (data.INTELLIGENCE_PROVIDER === 'BEDROCK' && !data.AWS_BEDROCK_MODEL_ID) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AWS_BEDROCK_MODEL_ID'],
      message: 'AWS_BEDROCK_MODEL_ID is required when INTELLIGENCE_PROVIDER=BEDROCK.',
    });
  }

  if (data.INTELLIGENCE_PROVIDER === 'MOCK' && data.NODE_ENV === 'production') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTELLIGENCE_PROVIDER'],
      message: 'INTELLIGENCE_PROVIDER=MOCK is not allowed in production.',
    });
  }

  if (data.REDIS_ENABLED === 'true' && !data.REDIS_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL is required when REDIS_ENABLED=true.',
    });
  }

  if (data.STORAGE_PROVIDER === 's3') {
    for (const field of ['AWS_REGION', 'AWS_S3_BUCKET']) {
      if (!data[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required when STORAGE_PROVIDER=s3.`,
        });
      }
    }

    const hasAccessKey = Boolean(data.AWS_ACCESS_KEY_ID);
    const hasSecretKey = Boolean(data.AWS_SECRET_ACCESS_KEY);
    if (hasAccessKey !== hasSecretKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AWS_ACCESS_KEY_ID'],
        message: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be provided together when using static credentials.',
      });
    }
  }

  if (data.QUEUE_PROVIDER === 'sqs' && !data.AWS_SQS_RESUME_IMPORT_QUEUE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AWS_SQS_RESUME_IMPORT_QUEUE_URL'],
      message: 'AWS_SQS_RESUME_IMPORT_QUEUE_URL is required when QUEUE_PROVIDER=sqs.',
    });
  }

  const smtpValues = [data.SMTP_HOST, data.SMTP_USER, data.SMTP_PASS].filter(Boolean).length;
  if (smtpValues > 0 && smtpValues < 3) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SMTP_HOST'],
      message: 'SMTP_HOST, SMTP_USER, and SMTP_PASS must be provided together for SMTP delivery.',
    });
  }

  if (data.GOOGLE_MEETING_ENABLED === 'true') {
    for (const field of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI']) {
      if (!data[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required when GOOGLE_MEETING_ENABLED=true.`,
        });
      }
    }
  }

  if (data.ZOOM_MEETING_ENABLED === 'true') {
    for (const field of ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_OAUTH_REDIRECT_URI']) {
      if (!data[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required when ZOOM_MEETING_ENABLED=true.`,
        });
      }
    }
  }

  if (data.NODE_ENV === 'production' && (data.GOOGLE_MEETING_ENABLED === 'true' || data.ZOOM_MEETING_ENABLED === 'true') && !data.MEETING_TOKEN_ENCRYPTION_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MEETING_TOKEN_ENCRYPTION_KEY'],
      message: 'MEETING_TOKEN_ENCRYPTION_KEY is required in production when a meeting provider integration is enabled.',
    });
  }

  if (data.AI_PROVIDER === 'bedrock' && !data.AWS_BEDROCK_MODEL_ID) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AWS_BEDROCK_MODEL_ID'],
      message: 'AWS_BEDROCK_MODEL_ID is required when AI_PROVIDER=bedrock.',
    });
  }

  if (data.AI_PROVIDER === 'mock' && data.NODE_ENV === 'production') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AI_PROVIDER'],
      message: 'AI_PROVIDER=mock is not allowed in production.',
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
  corsAllowedOrigins: (parsed.data.CORS_ALLOWED_ORIGINS || parsed.data.FRONTEND_URL)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  trustProxy: parsed.data.TRUST_PROXY === 'true',
  databaseUrl: parsed.data.DATABASE_URL,
  directUrl: parsed.data.DIRECT_URL || parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  apiBodyLimitMb: parsed.data.API_BODY_LIMIT_MB,
  fileUploadMaxMb: parsed.data.FILE_UPLOAD_MAX_MB,
  rateLimitMaxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
  elasticsearchEnabled: parsed.data.ELASTICSEARCH_ENABLED === 'true',
  elasticsearchUrl: parsed.data.ELASTICSEARCH_URL,
  elasticsearchIndex: parsed.data.ELASTICSEARCH_INDEX,
  redisEnabled: parsed.data.REDIS_ENABLED === 'true',
  redisUrl: parsed.data.REDIS_URL,
  redisKeyPrefix: parsed.data.REDIS_KEY_PREFIX,
  redisConnectTimeoutMs: parsed.data.REDIS_CONNECT_TIMEOUT_MS,
  storageProvider: parsed.data.STORAGE_PROVIDER,
  localStoragePath: parsed.data.LOCAL_STORAGE_PATH,
  awsRegion: parsed.data.AWS_REGION,
  awsBucket: parsed.data.AWS_S3_BUCKET,
  awsS3Endpoint: parsed.data.AWS_S3_ENDPOINT,
  awsS3ForcePathStyle: parsed.data.AWS_S3_FORCE_PATH_STYLE === 'true',
  awsAccessKeyId: parsed.data.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsed.data.AWS_SECRET_ACCESS_KEY,
  queueProvider: parsed.data.QUEUE_PROVIDER,
  awsSqsResumeImportQueueUrl: parsed.data.AWS_SQS_RESUME_IMPORT_QUEUE_URL,
  awsSqsResumeImportDlqUrl: parsed.data.AWS_SQS_RESUME_IMPORT_DLQ_URL,
  resumeImportWorkerConcurrency: parsed.data.RESUME_IMPORT_WORKER_CONCURRENCY,
  resumeImportMaxRetries: parsed.data.RESUME_IMPORT_MAX_RETRIES,
  resumeImportMaxFiles: parsed.data.RESUME_IMPORT_MAX_FILES,
  resumeMaxFileSizeMb: parsed.data.RESUME_MAX_FILE_SIZE_MB,
  resumeImportMaxZipSizeMb: parsed.data.RESUME_IMPORT_MAX_ZIP_SIZE_MB,
  resumeImportMaxUncompressedMb: parsed.data.RESUME_IMPORT_MAX_UNCOMPRESSED_MB,
  resumeImportMaxTextChars: parsed.data.RESUME_IMPORT_MAX_TEXT_CHARS,
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
  googleMeetingEnabled: parsed.data.GOOGLE_MEETING_ENABLED === 'true',
  googleMeetingRedirectUri: parsed.data.GOOGLE_OAUTH_REDIRECT_URI,
  linkedinClientId: parsed.data.LINKEDIN_CLIENT_ID,
  linkedinClientSecret: parsed.data.LINKEDIN_CLIENT_SECRET,
  linkedinRedirectUri: parsed.data.LINKEDIN_REDIRECT_URI,
  zoomMeetingEnabled: parsed.data.ZOOM_MEETING_ENABLED === 'true',
  zoomClientId: parsed.data.ZOOM_CLIENT_ID,
  zoomClientSecret: parsed.data.ZOOM_CLIENT_SECRET,
  zoomRedirectUri: parsed.data.ZOOM_OAUTH_REDIRECT_URI,
  customMeetingEnabled: parsed.data.CUSTOM_MEETING_ENABLED === 'true',
  publicAppUrl: parsed.data.PUBLIC_APP_URL || parsed.data.FRONTEND_URL,
  meetingTokenEncryptionKey: parsed.data.MEETING_TOKEN_ENCRYPTION_KEY,
  resumeBuilderEnabled: parsed.data.RESUME_BUILDER_ENABLED === 'true',
  resumeBuilderBaseUrl: parsed.data.RESUME_BUILDER_BASE_URL,
  resumeBuilderClientId: parsed.data.RESUME_BUILDER_CLIENT_ID,
  intelligenceEnabled: parsed.data.INTELLIGENCE_ENABLED === 'true',
  intelligenceProvider: parsed.data.INTELLIGENCE_PROVIDER,
  intelligenceModel: parsed.data.INTELLIGENCE_MODEL,
  intelligenceApiKey: parsed.data.INTELLIGENCE_API_KEY,
  intelligenceBaseUrl: parsed.data.INTELLIGENCE_BASE_URL,
  intelligenceTimeoutMs: parsed.data.INTELLIGENCE_TIMEOUT_MS,
  intelligenceMaxRetries: parsed.data.INTELLIGENCE_MAX_RETRIES,
  intelligenceMaxInputChars: parsed.data.INTELLIGENCE_MAX_INPUT_CHARS,
  intelligenceMaxOutputTokens: parsed.data.INTELLIGENCE_MAX_OUTPUT_TOKENS,
  aiProvider: parsed.data.AI_PROVIDER,
  aiResumeParsingEnabled: parsed.data.AI_RESUME_PARSING_ENABLED === 'true',
  awsBedrockRegion: parsed.data.AWS_BEDROCK_REGION || parsed.data.AWS_REGION,
  awsBedrockModelId: parsed.data.AWS_BEDROCK_MODEL_ID,
  aiRequestTimeoutMs: parsed.data.AI_REQUEST_TIMEOUT_MS,
  aiMaxRetries: parsed.data.AI_MAX_RETRIES,
  workerConcurrency: parsed.data.WORKER_CONCURRENCY,
  workerPollIntervalMs: parsed.data.WORKER_POLL_INTERVAL_MS,
  workerSchedulerIntervalMs: parsed.data.WORKER_SCHEDULER_INTERVAL_MS,
  taskRetentionDays: parsed.data.TASK_RETENTION_DAYS,
};
