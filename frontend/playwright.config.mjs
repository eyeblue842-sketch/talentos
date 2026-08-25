import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
      // Real local SMTP listener + HTTP peek API (backend/scripts/e2e-smtp-catcher.mjs)
      // that the e2e backend below is pointed at, so password-reset/OTP specs
      // can read the emailed link token / code back over HTTP after a genuine
      // SMTP delivery, instead of relying on the in-memory test transport.
      command: 'node ./scripts/e2e-smtp-catcher.mjs',
      cwd: '../backend',
      url: 'http://127.0.0.1:2526/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node ./scripts/start-e2e-server.mjs',
      cwd: '../backend',
      url: 'http://127.0.0.1:5001/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      // next.config.mjs sets `output: 'standalone'`. `next start` does not
      // work with a standalone build (it warns and falls back to defaults,
      // silently dropping the BACKEND_API_BASE_URL override below - every
      // server-side Route Handler then calls the wrong backend port and
      // fails with a raw "fetch failed"). The standalone build's own
      // server.js is the correct way to run it, and reads PORT/HOSTNAME
      // from the environment exactly like next start did. Next.js also
      // requires static assets and public/ to be copied into the
      // standalone output manually (documented, standard step) - without
      // it every JS/CSS chunk 404s and the page never hydrates at all.
      // public/ itself is optional (this repo has none), so the copy is
      // skipped rather than assumed, matching Next's own behavior.
      command: 'npx next build --webpack && node -e "const fs=require(\'fs\'); fs.cpSync(\'.next/static\',\'.next/standalone/frontend/.next/static\',{recursive:true}); if (fs.existsSync(\'public\')) fs.cpSync(\'public\',\'.next/standalone/frontend/public\',{recursive:true})" && node .next/standalone/frontend/server.js',
      cwd: '.',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: '3001',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001/api',
        BACKEND_API_BASE_URL: 'http://127.0.0.1:5001/api',
      },
      url: 'http://127.0.0.1:3001/auth/candidate/login',
      reuseExistingServer: true,
      timeout: 300000,
    },
  ],
});
