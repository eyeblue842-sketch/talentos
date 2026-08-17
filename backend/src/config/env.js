import dotenv from 'dotenv';
import { z } from 'zod';
import { getDefaultIntelligenceBaseUrl } from '../intelligence/providers/providerDefaults.js';

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
  RESUME_IMPORT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
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
  INTELLIGENCE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  INTELLIGENCE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  INTELLIGENCE_MAX_INPUT_CHARS: z.coerce.number().int().min(500).max(200000).default(30000),
  INTELLIGENCE_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(8000).default(1200),
  AI_PROVIDER: z.enum(['disabled', 'mock', 'bedrock']).default('disabled'),
  AI_RESUME_PARSING_ENABLED: z.enum(['true', 'false']).default('false'),
  AWS_BEDROCK_REGION: z.string().optional(),
  AWS_BEDROCK_MODEL_ID: z.string().optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  WORKER_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  TASK_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TASK_LEASE_DURATION_MS: z.coerce.number().int().min(30000).max(1800000).default(300000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(2000).max(60000).default(10000),
  WORKER_HEARTBEAT_STALE_MS: z.coerce.number().int().min(10000).max(300000).default(45000),

  // Document-processing service (Track B, Step 3): disabled by default so
  // existing Node-only resume-import behaviour is completely unaffected
  // until an engine (Docling/PaddleOCR) actually lands and is explicitly
  // wired into the import pipeline in a later step.
  DOCUMENT_PROCESSOR_ENABLED: z.enum(['true', 'false']).default('false'),
  DOCUMENT_PROCESSOR_URL: z.string().url().default('http://127.0.0.1:8081'),
  DOCUMENT_PROCESSOR_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(3000),
  // Step 4.5: the Python service enforces its own hard per-job deadline
  // OUTSIDE the worker process, so a stuck engine can no longer run
  // unbounded -- this value must stay safely ABOVE the Python side's
  // deadline(s) plus transport/queue-wait margin, or Node would abandon
  // (AbortController) a request Python was about to cleanly resolve with
  // its own 504 PROCESSING_TIMEOUT.
  //
  // Step 6 changed the worst case: a single /v1/documents/analyse
  // request for a PDF can now invoke Docling (DOCLING_CONVERSION_TIMEOUT_SECONDS,
  // default 45s) AND THEN, additively in the same request, OCR
  // (OCR_CONVERSION_TIMEOUT_SECONDS, default 60s) when PADDLEOCR_ENABLED
  // is on -- these are two SEQUENTIAL worker calls within one HTTP
  // request, not alternatives, so the worst case is their SUM, not their
  // max. Default here = 45s + 60s (both Python hard deadlines, worst
  // case) + 15s margin = 120s. If DOCLING_CONVERSION_TIMEOUT_SECONDS,
  // OCR_CONVERSION_TIMEOUT_SECONDS, or either QUEUE_CAPACITY change on
  // the Python side, this must be revisited (see
  // docs/document-processor.md's worked timeout math).
  DOCUMENT_PROCESSOR_RESPONSE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(120000),
  DOCUMENT_PROCESSOR_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(50).default(5),
  DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1000).max(600000).default(30000),

  // Subscriptions/Billing/Payment Gateway (feature/subscriptions-billing-entitlements).
  // Razorpay Test Mode only during development - RAZORPAY_ENABLED gates the whole
  // module so it stays inert (checkout disabled, webhook signature checks reject
  // everything) until real key material is supplied. The four *_BUTTON_ID vars are
  // the public Razorpay Payment Button ids from the brief - stored for display/
  // reference only; they do NOT grant entitlements (see billingService/razorpayService
  // and the Stage 1 design report for why Payment Buttons can't be securely
  // correlated to a company/purchase, and why Orders API + Standard Checkout is the
  // actual entitlement-granting path).
  RAZORPAY_ENABLED: z.enum(['true', 'false']).default('false'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_BUTTON_JOB_POST_45D: z.string().optional(),
  RAZORPAY_BUTTON_ATS_DB_1M: z.string().optional(),
  RAZORPAY_BUTTON_ATS_DB_6M: z.string().optional(),
  RAZORPAY_BUTTON_ATS_DB_12M: z.string().optional(),
  // Careeriz's own registered GST home state code (2 digits), used to decide
  // CGST+SGST (intra-state) vs IGST (inter-state) on generated invoices.
  BILLING_SELLER_STATE_CODE: z.string().regex(/^[0-9]{2}$/).optional(),
  BILLING_SELLER_LEGAL_NAME: z.string().optional(),
  BILLING_SELLER_GSTIN: z.string().optional(),
  // How long an unused, separately-purchased job credit (the extra Rs.1,770
  // top-up) stays valid before it is swept as expired. Configurable per
  // section 10's explicit instruction; subscription-included credits instead
  // expire with their subscription and are not affected by this value.
  BILLING_PURCHASED_CREDIT_VALIDITY_MONTHS: z.coerce.number().int().min(1).max(60).default(12),
  // Separately purchased job-posting credits do not expire for now (binding
  // product decision - the unconfirmed 12-month assumption was removed).
  // This flag exists purely so that policy can change later without another
  // schema/code change: BILLING_PURCHASED_CREDIT_VALIDITY_MONTHS above stays
  // configurable and is only actually applied when this is 'true'.
  BILLING_PURCHASED_CREDIT_EXPIRY_ENABLED: z.enum(['true', 'false']).default('false'),
  BILLING_RENEWAL_REMINDER_DAYS_BEFORE: z.coerce.number().int().min(1).max(60).default(15),
  // Rollout kill-switch (B1 hardening, section 2): the entitlement
  // middleware and job-credit consumption are fully implemented and always
  // COMPUTED, but only actually BLOCK/CONSUME when this is 'true' (or the
  // organisation is in the rollout allowlist below). Defaults to 'false' so
  // deploying this migration/code never locks out an existing paying
  // organisation with zero billing history. Server-side only - no request
  // header, query param, or client value can influence this.
  BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED: z.enum(['true', 'false']).default('false'),
  BILLING_ENTITLEMENT_ROLLOUT_ORG_IDS: z.string().optional(),
  // Opt-in only. When both this and the enforcement flag are false (the
  // default), the entitlement gates perform ZERO additional queries and are
  // a true no-op - existing behaviour is bit-for-bit unchanged, not just
  // "unblocked". Turn this on temporarily during rollout planning to see
  // shadow.wouldBlock decisions in logs before flipping enforcement on.
  BILLING_ENTITLEMENT_SHADOW_LOGGING_ENABLED: z.enum(['true', 'false']).default('false'),
  // CAREERIZ EMPLOYER ACCESS, domain-ownership closure section 1: same
  // kill-switch pattern as BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED above -
  // fully implemented and always computable, but only actually blocks
  // COMPANY organisations stuck in domainVerificationStatus=PENDING when
  // this is 'true' (or the organisation is in the allowlist below).
  // Defaults to 'false' so deploying this code never locks out an existing
  // organisation created before this feature existed (type=null) or any
  // organisation created before enforcement is deliberately turned on.
  EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED: z.enum(['true', 'false']).default('false'),
  EMPLOYER_ORGANISATION_VERIFICATION_ROLLOUT_ORG_IDS: z.string().optional(),
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

  const hasDefaultIntelligenceBaseUrl = Boolean(getDefaultIntelligenceBaseUrl(data.INTELLIGENCE_PROVIDER));

  if (providerEnabled && !['MOCK', 'BEDROCK'].includes(data.INTELLIGENCE_PROVIDER) && !data.INTELLIGENCE_BASE_URL && !hasDefaultIntelligenceBaseUrl) {
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

  if (data.RAZORPAY_ENABLED === 'true') {
    for (const field of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
      if (!data[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required when RAZORPAY_ENABLED=true.`,
        });
      }
    }
  }

  if (data.NODE_ENV === 'production' && data.RAZORPAY_ENABLED === 'true' && data.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RAZORPAY_KEY_ID'],
      message: 'A Razorpay Test Mode key (rzp_test_...) must not be used when NODE_ENV=production.',
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
  taskLeaseDurationMs: parsed.data.TASK_LEASE_DURATION_MS,
  workerHeartbeatIntervalMs: parsed.data.WORKER_HEARTBEAT_INTERVAL_MS,
  workerHeartbeatStaleMs: parsed.data.WORKER_HEARTBEAT_STALE_MS,
  documentProcessorEnabled: parsed.data.DOCUMENT_PROCESSOR_ENABLED === 'true',
  documentProcessorUrl: parsed.data.DOCUMENT_PROCESSOR_URL,
  documentProcessorConnectTimeoutMs: parsed.data.DOCUMENT_PROCESSOR_CONNECT_TIMEOUT_MS,
  documentProcessorResponseTimeoutMs: parsed.data.DOCUMENT_PROCESSOR_RESPONSE_TIMEOUT_MS,
  documentProcessorMaxRetries: parsed.data.DOCUMENT_PROCESSOR_MAX_RETRIES,
  documentProcessorCircuitBreakerThreshold: parsed.data.DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_THRESHOLD,
  documentProcessorCircuitBreakerCooldownMs: parsed.data.DOCUMENT_PROCESSOR_CIRCUIT_BREAKER_COOLDOWN_MS,
  razorpayEnabled: parsed.data.RAZORPAY_ENABLED === 'true',
  razorpayKeyId: parsed.data.RAZORPAY_KEY_ID,
  razorpayKeySecret: parsed.data.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: parsed.data.RAZORPAY_WEBHOOK_SECRET,
  razorpayButtonIds: {
    JOB_POST_45D: parsed.data.RAZORPAY_BUTTON_JOB_POST_45D || null,
    ATS_DB_1M: parsed.data.RAZORPAY_BUTTON_ATS_DB_1M || null,
    ATS_DB_6M: parsed.data.RAZORPAY_BUTTON_ATS_DB_6M || null,
    ATS_DB_12M: parsed.data.RAZORPAY_BUTTON_ATS_DB_12M || null,
  },
  billingSellerStateCode: parsed.data.BILLING_SELLER_STATE_CODE || null,
  billingSellerLegalName: parsed.data.BILLING_SELLER_LEGAL_NAME || 'Careeriz',
  billingSellerGstin: parsed.data.BILLING_SELLER_GSTIN || null,
  billingPurchasedCreditValidityMonths: parsed.data.BILLING_PURCHASED_CREDIT_VALIDITY_MONTHS,
  billingPurchasedCreditExpiryEnabled: parsed.data.BILLING_PURCHASED_CREDIT_EXPIRY_ENABLED === 'true',
  billingRenewalReminderDaysBefore: parsed.data.BILLING_RENEWAL_REMINDER_DAYS_BEFORE,
  billingEntitlementEnforcementEnabled: parsed.data.BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED === 'true',
  billingEntitlementRolloutOrgIds: (parsed.data.BILLING_ENTITLEMENT_ROLLOUT_ORG_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  billingEntitlementShadowLoggingEnabled: parsed.data.BILLING_ENTITLEMENT_SHADOW_LOGGING_ENABLED === 'true',
  employerOrganisationVerificationEnforcementEnabled: parsed.data.EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED === 'true',
  employerOrganisationVerificationRolloutOrgIds: (parsed.data.EMPLOYER_ORGANISATION_VERIFICATION_ROLLOUT_ORG_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
};
