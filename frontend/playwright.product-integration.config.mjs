import { defineConfig } from '@playwright/test';

// Dedicated, isolated harness for the product-integration acceptance spec
// only. Enables Resume Search V2 for THIS runtime alone (disposable
// backend/Postgres/OpenSearch), via env vars supplied by the caller's own
// private process environment - never a production/default config change.
// Keep this config's testMatch scoped to a single file so no other e2e
// spec (see playwright.config.mjs / messaging-phase1.spec.ts) ever
// inherits these overrides.

const organisationId = process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS;
if (!organisationId) {
  throw new Error(
    'Missing RESUME_SEARCH_V2_ALLOWED_ORG_IDS. Run ' +
    'backend/scripts/pi-e2e-resume-search-bootstrap.mjs first and export its ' +
    'organisationId into this shell before running this config - see ' +
    'docs in that script\'s header. This never falls back to a hardcoded id.'
  );
}

const openSearchEnv = {
  RESUME_SEARCH_V2_ENABLED: 'true',
  RESUME_INDEXING_ENABLED: 'true',
  RESUME_SEARCH_ENGINE_PROVIDER: 'opensearch',
  OPENSEARCH_NODE: process.env.OPENSEARCH_NODE || 'http://127.0.0.1:9204',
  OPENSEARCH_INDEX_PREFIX: process.env.OPENSEARCH_INDEX_PREFIX || 'careeriz-pi-e2e',
  OPENSEARCH_CURSOR_SECRET: process.env.OPENSEARCH_CURSOR_SECRET || 'fictional-pi-e2e-cursor-secret-local-only',
  RESUME_INDEXING_ALLOWED_ORG_IDS: organisationId,
  // Both default to 'false' (shadow/log-only) if unset - explicitly turn
  // them on so this harness exercises the real enforcement path, not just
  // logging, per the task's "keep gates active" requirement.
  BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED: 'true',
  EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED: 'true',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: 'pi-product-integration.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 180000,
  expect: {
    timeout: 20000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ./scripts/start-e2e-server.mjs',
      cwd: '../backend',
      url: 'http://127.0.0.1:5001/api/health',
      // No reuse: every run of this isolated harness starts fresh servers
      // against the disposable stack, so a prior run's process/state can
      // never contaminate this one.
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...process.env,
        ...openSearchEnv,
      },
    },
    {
      command: 'npx next build --webpack && node -e "const fs=require(\'fs\'); fs.cpSync(\'.next/static\',\'.next/standalone/frontend/.next/static\',{recursive:true}); if (fs.existsSync(\'public\')) fs.cpSync(\'public\',\'.next/standalone/frontend/public\',{recursive:true})" && node .next/standalone/frontend/server.js',
      cwd: '.',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: '3001',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001/api',
        BACKEND_API_BASE_URL: 'http://127.0.0.1:5001/api',
        // Frontend-only rollout gates (lib/feature-flags.js,
        // lib/resume-search-v2-rollout.server.js) - both read server-side
        // at request time, isolated to this harness's server process.
        NEXT_PUBLIC_FEATURE_RESUME_SEARCH_V2: 'true',
        RESUME_SEARCH_V2_ALLOWED_ORG_IDS: organisationId,
        // The legacy semantic-search workspace is the real fallback any
        // org NOT in the V2 allowlist above still lands on (see
        // app/recruiter/database/results/page.jsx) - enable it too so a
        // non-allowlisted (e.g. pending-verification) org exercises its
        // real entitlement/verification gate instead of a blanket
        // feature-disabled placeholder.
        NEXT_PUBLIC_FEATURE_SEMANTIC_SEARCH: 'true',
      },
      url: 'http://127.0.0.1:3001/auth/candidate/login',
      reuseExistingServer: false,
      timeout: 300000,
    },
  ],
});
