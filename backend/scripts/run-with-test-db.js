import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env.test') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDirectUrl = process.env.TEST_DIRECT_URL || testDatabaseUrl;

if (!testDatabaseUrl) {
  console.error('Missing TEST_DATABASE_URL. Configure an isolated PostgreSQL test database or schema before running this command.');
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node ./scripts/run-with-test-db.js <command> [...args]');
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    DIRECT_URL: testDirectUrl,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
