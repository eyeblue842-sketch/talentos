// Pure config resolution for start-e2e-server.mjs - no side effects, no
// database/server connection. TEST_DATABASE_URL/TEST_DIRECT_URL must come
// from the caller's own private process environment (shell export, CI
// secret, etc.) - this never reads a tracked file and never falls back to
// a shared/production/hardcoded credential.
export function resolveE2eDatabaseConfig(env = process.env) {
  const databaseUrl = env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Missing TEST_DATABASE_URL for the e2e server. Export TEST_DATABASE_URL ' +
      '(and optionally TEST_DIRECT_URL) as private process environment variables ' +
      'before running start-e2e-server.mjs - see docs/backend-test-database.md. ' +
      'This never falls back to a tracked, shared, or production credential.'
    );
  }

  const directUrl = env.TEST_DIRECT_URL || databaseUrl;

  return { databaseUrl, directUrl };
}
