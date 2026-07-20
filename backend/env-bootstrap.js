import { resolve } from 'node:path';
import dotenv from 'dotenv';

process.env.NODE_ENV = 'test';

dotenv.config({ path: resolve(process.cwd(), '.env.test') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDirectUrl = process.env.TEST_DIRECT_URL || testDatabaseUrl;

if (!testDatabaseUrl) {
  throw new Error(
    'Missing TEST_DATABASE_URL for backend tests. Configure a dedicated PostgreSQL test database or isolated schema before running the suite.'
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDirectUrl;
