import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerStarter } from '../server.js';
import { parseEnv } from '../config/env.js';

function createRequiredEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    PORT: '5000',
    FRONTEND_URL: 'http://localhost:3000',
    BACKEND_URL: 'http://localhost:5000',
    DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/careeriz?schema=public',
    JWT_SECRET: '12345678901234567890123456789012',
    JWT_EXPIRES_IN: '7d',
    ...overrides,
  };
}

test('backend startup skips Elasticsearch initialization when disabled', async () => {
  let ensureCalls = 0;
  const warnings = [];
  const application = {
    listen(port, callback) {
      callback();
      return { port };
    },
  };

  const start = createServerStarter({
    application,
    runtimeEnv: { port: 5000 },
    elasticsearchEnabled: () => false,
    ensureResumeIndexFn: async () => {
      ensureCalls += 1;
    },
    logger: {
      warn: (message) => warnings.push(message),
      log: () => {},
      error: () => {},
    },
    exit: () => {
      throw new Error('exit should not be called');
    },
  });

  const server = await start();
  assert.deepEqual(server, { port: 5000 });
  assert.equal(ensureCalls, 0);
  assert.deepEqual(warnings, ['Elasticsearch is disabled. Resume search functionality is unavailable.']);
});

test('backend startup calls ensureResumeIndex when Elasticsearch is enabled', async () => {
  let ensureCalls = 0;
  const start = createServerStarter({
    application: {
      listen(port, callback) {
        callback();
        return { port };
      },
    },
    runtimeEnv: { port: 5000 },
    elasticsearchEnabled: () => true,
    ensureResumeIndexFn: async () => {
      ensureCalls += 1;
    },
    logger: {
      warn: () => {},
      log: () => {},
      error: () => {},
    },
    exit: () => {
      throw new Error('exit should not be called');
    },
  });

  await start();
  assert.equal(ensureCalls, 1);
});

test('backend startup remains fail-fast when Elasticsearch is enabled and initialization fails', async () => {
  let exitCode = null;
  const logged = [];
  const start = createServerStarter({
    application: {
      listen() {
        throw new Error('listen should not be reached');
      },
    },
    runtimeEnv: { port: 5000 },
    elasticsearchEnabled: () => true,
    ensureResumeIndexFn: async () => {
      throw new Error('Elasticsearch unavailable');
    },
    logger: {
      warn: () => {},
      log: () => {},
      error: (...args) => logged.push(args),
    },
    exit: (code) => {
      exitCode = code;
    },
  });

  const result = await start();
  assert.equal(result, null);
  assert.equal(exitCode, 1);
  assert.equal(logged[0][0], 'Failed to start server');
  assert.match(logged[0][1].message, /Elasticsearch unavailable/);
});

test('missing ELASTICSEARCH_URL fails validation when Elasticsearch is enabled', () => {
  const parsed = parseEnv(createRequiredEnv({
    ELASTICSEARCH_ENABLED: 'true',
  }));

  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0].message, /ELASTICSEARCH_URL is required/i);
});

test('missing ELASTICSEARCH_URL is allowed when Elasticsearch is disabled', () => {
  const parsed = parseEnv(createRequiredEnv({
    ELASTICSEARCH_ENABLED: 'false',
  }));

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.ELASTICSEARCH_URL, undefined);
});
