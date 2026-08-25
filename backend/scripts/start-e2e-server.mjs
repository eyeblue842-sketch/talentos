import '../src/__tests__/setup/node-test-globals.js';
import { resolveE2eDatabaseConfig } from './resolveE2eDatabaseConfig.js';

// Resolved before any other setup, and before the env-clearing loop below,
// so a missing TEST_DATABASE_URL fails fast with a clear error instead of
// partially clearing process.env and then failing deeper inside server
// startup.
const { databaseUrl, directUrl } = resolveE2eDatabaseConfig();

for (const key of [
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'BACKEND_URL',
  'CORS_ALLOWED_ORIGINS',
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'STORAGE_PROVIDER',
  'LOCAL_STORAGE_PATH',
  'ELASTICSEARCH_ENABLED',
  'REDIS_ENABLED',
  'INTELLIGENCE_ENABLED',
  'INTELLIGENCE_PROVIDER',
  'QUEUE_PROVIDER',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
]) {
  delete process.env[key];
}

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '5001',
  FRONTEND_URL: 'http://127.0.0.1:3001',
  BACKEND_URL: 'http://127.0.0.1:5001',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3001',
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl,
  JWT_SECRET: 'careeriz-messaging-phase1-e2e-secret-123456',
  STORAGE_PROVIDER: 'local',
  LOCAL_STORAGE_PATH: './storage/resumes',
  ELASTICSEARCH_ENABLED: 'false',
  REDIS_ENABLED: 'false',
  INTELLIGENCE_ENABLED: 'false',
  INTELLIGENCE_PROVIDER: 'DISABLED',
  QUEUE_PROVIDER: 'database',
  EMAIL_FROM: 'no-reply@careeriz.app',
  AUTH_LOGIN_RATE_LIMIT: '1000',
  // Real SMTP delivery to a local catcher (backend/scripts/e2e-smtp-catcher.mjs,
  // started as its own Playwright webServer entry) so password-reset/OTP e2e
  // specs exercise genuine SMTP acceptance rather than the in-memory test
  // transport - env.isTest is false here (NODE_ENV=development, and this
  // process is not run under `node --test`), so createTransport() resolves
  // to the real SMTP branch. SMTP_USER/PASS are placeholders only to satisfy
  // env validation (host/user/pass must all be present together) - the
  // catcher disables the AUTH command entirely, so nodemailer's SMTP client
  // never actually attempts to authenticate with them (RFC 5321: a client
  // only authenticates if the server advertises an AUTH mechanism in EHLO).
  SMTP_HOST: process.env.E2E_SMTP_CATCHER_HOST || '127.0.0.1',
  SMTP_PORT: process.env.E2E_SMTP_CATCHER_PORT || '2525',
  SMTP_USER: 'e2e-catcher',
  SMTP_PASS: 'e2e-catcher',
});

const { start } = await import('../src/server.js');
await start();
