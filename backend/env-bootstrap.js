import { resolve } from 'node:path';
import dotenv from 'dotenv';
import './src/__tests__/setup/node-test-globals.js';

process.env.NODE_ENV = 'test';

// .env.test.local is private and git-ignored - it is the only place a real
// TEST_DATABASE_URL/TEST_DIRECT_URL should ever live on a developer machine
// (or they can be exported directly as process environment variables, e.g.
// in CI). It is loaded first so dotenv's "don't override an already-set
// var" default lets it win over the tracked placeholders below.
dotenv.config({ path: resolve(process.cwd(), '.env.test.local') });
dotenv.config({ path: resolve(process.cwd(), '.env.test') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.BACKEND_URL ||= 'http://127.0.0.1:5000';
process.env.CORS_ALLOWED_ORIGINS ||= process.env.FRONTEND_URL;
process.env.JWT_SECRET ||= 'careeriz-test-jwt-secret-32-characters';

const isPlaceholder = (value) => !value || value.startsWith('REPLACE_WITH_');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
// A placeholder TEST_DIRECT_URL (from the tracked backend/.env.test) is not
// a real override - treat it the same as "unset" so it still falls back to
// TEST_DATABASE_URL, exactly like before this file drew a distinction
// between real values and tracked placeholders.
const testDirectUrl = isPlaceholder(process.env.TEST_DIRECT_URL) ? testDatabaseUrl : process.env.TEST_DIRECT_URL;

// backend/.env.test is tracked in git and must only ever contain
// non-operational placeholders (see docs/backend-test-database.md) - never
// fall back to those placeholders as if they were a usable connection
// string, and never fall back to any production/shared credential either.
if (isPlaceholder(testDatabaseUrl) || isPlaceholder(testDirectUrl)) {
  throw new Error(
    'Missing TEST_DATABASE_URL/TEST_DIRECT_URL for backend tests. ' +
    'Create a private backend/.env.test.local (git-ignored, see docs/backend-test-database.md) ' +
    'or export TEST_DATABASE_URL/TEST_DIRECT_URL in your shell before running the suite. ' +
    'The committed backend/.env.test only holds non-operational placeholders.'
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDirectUrl;
