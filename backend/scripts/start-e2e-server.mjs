import '../src/__tests__/setup/node-test-globals.js';

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
]) {
  delete process.env[key];
}

Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '5001',
  FRONTEND_URL: 'http://127.0.0.1:3001',
  BACKEND_URL: 'http://127.0.0.1:5001',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3001',
  DATABASE_URL: 'postgresql://postgres.qhjwwomponhjjnhvufiz:s9cXwn9J1tv52OcH@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=careeriz_test',
  DIRECT_URL: 'postgresql://postgres.qhjwwomponhjjnhvufiz:s9cXwn9J1tv52OcH@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?schema=careeriz_test',
  JWT_SECRET: 'careeriz-messaging-phase1-e2e-secret-123456',
  STORAGE_PROVIDER: 'local',
  LOCAL_STORAGE_PATH: './storage/resumes',
  ELASTICSEARCH_ENABLED: 'false',
  REDIS_ENABLED: 'false',
  INTELLIGENCE_ENABLED: 'false',
  INTELLIGENCE_PROVIDER: 'DISABLED',
  QUEUE_PROVIDER: 'database',
  EMAIL_FROM: 'no-reply@careeriz.app',
});

const { start } = await import('../src/server.js');
await start();
