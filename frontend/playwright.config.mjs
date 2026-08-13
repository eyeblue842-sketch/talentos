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
      command: 'node ./scripts/start-e2e-server.mjs',
      cwd: '../backend',
      url: 'http://127.0.0.1:5001/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'npx next build --webpack && node ../node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001',
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
