import { resolve } from 'node:path';
import dotenv from 'dotenv';
import './src/__tests__/setup/node-test-globals.js';

process.env.NODE_ENV = 'test';

dotenv.config({ path: resolve(process.cwd(), '.env.test') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.BACKEND_URL ||= 'http://127.0.0.1:5000';
process.env.CORS_ALLOWED_ORIGINS ||= process.env.FRONTEND_URL;
process.env.JWT_SECRET ||= 'careeriz-test-jwt-secret-32-characters';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDirectUrl = process.env.TEST_DIRECT_URL || testDatabaseUrl;

if (!testDatabaseUrl) {
  throw new Error(
    'Missing TEST_DATABASE_URL for backend tests. Configure a dedicated PostgreSQL test database or isolated schema before running the suite.'
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDirectUrl;
