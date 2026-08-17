import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveE2eDatabaseConfig } from '../../scripts/resolveE2eDatabaseConfig.js';

// Pure config-resolution tests for backend/scripts/start-e2e-server.mjs.
// No database or server connection is made anywhere in this file - only
// fictional fixture connection strings, and only an in-memory env object
// (never process.env itself), are used.

test('throws a clear configuration error before startup when TEST_DATABASE_URL is missing', () => {
  assert.throws(() => resolveE2eDatabaseConfig({}), /Missing TEST_DATABASE_URL/);
});

test('does not fall back to any hardcoded or tracked value when nothing is configured', () => {
  assert.throws(
    () => resolveE2eDatabaseConfig({ SOME_UNRELATED_VAR: 'x' }),
    /Missing TEST_DATABASE_URL/
  );
});

test('honors TEST_DATABASE_URL, and TEST_DIRECT_URL deterministically falls back to it when unset', () => {
  const result = resolveE2eDatabaseConfig({
    TEST_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:5555/fixture_db',
  });
  assert.equal(result.databaseUrl, 'postgresql://fixture:fixture@127.0.0.1:5555/fixture_db');
  assert.equal(result.directUrl, result.databaseUrl);
});

test('honors TEST_DIRECT_URL independently when both variables are set', () => {
  const result = resolveE2eDatabaseConfig({
    TEST_DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:5555/db_a',
    TEST_DIRECT_URL: 'postgresql://fixture:fixture@127.0.0.1:5555/db_b',
  });
  assert.equal(result.databaseUrl, 'postgresql://fixture:fixture@127.0.0.1:5555/db_a');
  assert.equal(result.directUrl, 'postgresql://fixture:fixture@127.0.0.1:5555/db_b');
});
