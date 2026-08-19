// CAREERIZ PRODUCT INTEGRATION - isolated E2E harness bootstrap for
// Resume Search V2. Prepares a dedicated, versioned OpenSearch index/alias
// pair and seeds one fictional org + fictional indexed candidate against
// the disposable e2e backend/Postgres/OpenSearch stack, then prints the
// resulting organisation id so the caller can allowlist it for both the
// backend indexing gate and the frontend rollout gate.
//
// Does not touch production defaults: every value here is either read from
// the caller's own private process environment or defaulted to an
// obviously local-only/fictional value. Never processes or references any
// protected/real production batch.
//
// Expects a dedicated, disposable OpenSearch on OPENSEARCH_NODE (default
// http://127.0.0.1:9204) - deliberately NOT the shared careeriz-pi2-opensearch
// dev instance (port 9203), whose careeriz-resume-search-write alias may
// already point at a regular local-dev index. Start one with e.g.:
//   docker run -d --name careeriz-pi-e2e-search \
//     -e "discovery.type=single-node" -e "DISABLE_SECURITY_PLUGIN=true" \
//     -e "DISABLE_INSTALL_DEMO_CONFIG=true" -p 9204:9200 \
//     opensearchproject/opensearch:3.5.0
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const BACKEND_URL = 'http://127.0.0.1:5001';
const HEALTH_URL = `${BACKEND_URL}/api/health`;

const openSearchEnv = {
  RESUME_SEARCH_V2_ENABLED: 'true',
  RESUME_INDEXING_ENABLED: 'true',
  RESUME_SEARCH_ENGINE_PROVIDER: 'opensearch',
  OPENSEARCH_NODE: process.env.OPENSEARCH_NODE || 'http://127.0.0.1:9204',
  OPENSEARCH_INDEX_PREFIX: process.env.OPENSEARCH_INDEX_PREFIX || 'careeriz-pi-e2e',
  OPENSEARCH_CURSOR_SECRET: process.env.OPENSEARCH_CURSOR_SECRET || 'fictional-pi-e2e-cursor-secret-local-only',
  // Both default to 'false' (shadow/log-only) if unset - explicitly turn
  // them on so the seeded org's real signup/approval/subscription flow is
  // exercised against genuine enforcement, matching the harness Playwright
  // will run against.
  BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED: 'true',
  EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED: 'true',
};

function log(event, detail) {
  console.error(JSON.stringify({ event, ...detail }));
}

async function waitForHealth(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function spawnBackend(extraEnv) {
  const backend = spawn('node', ['./scripts/start-e2e-server.mjs'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...openSearchEnv, ...extraEnv },
    stdio: 'inherit',
  });
  await waitForHealth(HEALTH_URL);
  return backend;
}

// QUEUE_PROVIDER=database (set by start-e2e-server.mjs) means background
// tasks - including best-effort resume search indexing - are only picked
// up by the separate worker process (src/worker.js), never by the HTTP
// server itself. start-e2e-server.mjs deletes/reassigns a fixed set of
// keys and does not touch DATABASE_URL beyond that, so spawning the
// worker with the same resolved env keeps it pointed at the same
// disposable Postgres/OpenSearch as the backend it is paired with.
function spawnWorker(extraEnv) {
  return spawn('node', ['src/worker.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      ...openSearchEnv,
      ...extraEnv,
      NODE_ENV: 'development',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DIRECT_URL: process.env.TEST_DIRECT_URL || process.env.TEST_DATABASE_URL,
      FRONTEND_URL: 'http://127.0.0.1:3001',
      BACKEND_URL: 'http://127.0.0.1:5001',
      STORAGE_PROVIDER: 'local',
      LOCAL_STORAGE_PATH: './storage/resumes',
      QUEUE_PROVIDER: 'database',
    },
    stdio: 'inherit',
  });
}

async function main() {
  log('bootstrap.opensearch.reindex.start', { prefix: openSearchEnv.OPENSEARCH_INDEX_PREFIX });
  execFileSync('node', ['./scripts/resume-search-reindex.js', '--execute', '--test-mode', '--confirm-alias-switch'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...openSearchEnv },
    stdio: 'inherit',
  });
  log('bootstrap.opensearch.reindex.done', {});

  // Phase 1: no indexing allowlist yet (the org id doesn't exist until we
  // create it) - just enough to run signup/onboarding/subscription setup.
  log('bootstrap.backend.spawn.phase1', { url: BACKEND_URL });
  let backend = await spawnBackend({});
  log('bootstrap.backend.healthy', {});

  const seedEnv = { ...process.env, PI_BACKEND_BASE_URL: `${BACKEND_URL}/api` };
  const setupOnlyOut = execFileSync('node', ['./scripts/pi-phase-e-parsing-indexing.mjs', '--setup-only'], {
    cwd: BACKEND_DIR,
    env: seedEnv,
    encoding: 'utf8',
  });
  const setupLine = setupOnlyOut.trim().split('\n').filter(Boolean).pop();
  const organisationId = JSON.parse(setupLine).organisationId;
  log('bootstrap.org.ready', { organisationId });

  // pi-phase-f-seed.mjs requires the Phase E org above to already exist,
  // and (idempotently) ensures the stable PENDING org the Playwright spec
  // logs in as for its restricted-access test. Capture its id too so it
  // can be allowlisted for V2 rollout alongside the verified org - the
  // real entitlement/verification gate should still block it, unlike the
  // unrelated legacy AI-search fallback it would otherwise fall through to.
  const pendingSeedOut = execFileSync('node', ['../backend/scripts/pi-phase-f-seed.mjs'], {
    cwd: path.resolve(BACKEND_DIR, '../frontend'),
    env: seedEnv,
    encoding: 'utf8',
  });
  const pendingOrganisationId = JSON.parse(pendingSeedOut.trim()).pending.organisationId;
  log('bootstrap.pending-org.ready', { pendingOrganisationId });

  backend.kill();
  log('bootstrap.backend.stopped.phase1', {});

  if (!organisationId || !pendingOrganisationId) {
    throw new Error('Bootstrap did not resolve both organisation ids.');
  }

  const allowedOrgIds = `${organisationId},${pendingOrganisationId}`;

  // Phase 2: restart with the indexing allowlist now that the org id is
  // known, then run the full parse/confirm/index/search flow against it.
  log('bootstrap.backend.spawn.phase2', { url: BACKEND_URL, organisationId });
  backend = await spawnBackend({ RESUME_INDEXING_ALLOWED_ORG_IDS: organisationId });
  log('bootstrap.backend.healthy', {});

  log('bootstrap.worker.spawn', {});
  const worker = spawnWorker({ RESUME_INDEXING_ALLOWED_ORG_IDS: organisationId });
  // No health endpoint on the worker - it starts polling the database task
  // queue within its own WORKER_POLL_INTERVAL_MS; a short fixed settle
  // window here is a one-time process-startup wait, not a substitute for
  // the deterministic indexed-status polling pi-phase-e already does.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    execFileSync('node', ['./scripts/pi-phase-e-parsing-indexing.mjs'], {
      cwd: BACKEND_DIR,
      env: seedEnv,
      stdio: 'inherit',
    });
    log('bootstrap.candidate.indexed', {});
  } finally {
    worker.kill();
    backend.kill();
    log('bootstrap.backend.stopped.phase2', {});
  }

  console.log(JSON.stringify({ organisationId, pendingOrganisationId, allowedOrgIds, openSearchIndexPrefix: openSearchEnv.OPENSEARCH_INDEX_PREFIX }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'bootstrap.crashed', message: error?.message }));
  process.exitCode = 1;
});
