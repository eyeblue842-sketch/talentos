import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// U2/U3/U4 modernization smoke coverage - fictional accounts only, seeded
// fresh via the existing employer-auth-flow seed script (recruiter +
// candidate) plus the platform admin created during local setup bootstrap.
// Never touches a real user or a real password.

type SeedResult = {
  password: string;
  recruiter: { email: string };
  candidate: { email: string };
};

const seedScript = path.resolve(process.cwd(), '../backend/scripts/seed-employer-auth-e2e.mjs');

function seed(): SeedResult {
  return JSON.parse(execFileSync('node', [seedScript], { encoding: 'utf8' }).trim()) as SeedResult;
}

async function loginCandidate(page, email: string, password: string) {
  await page.goto('/auth/candidate/login', { waitUntil: 'domcontentloaded' });
  // A cold-started standalone server's very first request can serve HTML
  // before client hydration has attached handlers - waiting for the Sign
  // in button itself (not just DOM content) avoids filling/clicking a
  // not-yet-interactive form.
  await page.getByRole('button', { name: /^sign in$/i }).first().waitFor({ state: 'visible' });
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
  await form.getByLabel(/^email$/i).first().fill(email);
  await form.getByLabel(/^password$/i).first().fill(password);
  await form.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname === '/candidate/dashboard', { timeout: 30000 });
}

async function loginRecruiter(page, email: string, password: string) {
  await page.goto('/hire/login?employerType=CONSULTANCY', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^sign in$/i }).first().waitFor({ state: 'visible' });
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
  await form.getByLabel(/work email|email/i).first().fill(email);
  await form.getByLabel(/^password$/i).first().fill(password);
  await form.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
}

test.describe('U2/U3/U4 modernization smoke', () => {
  test('candidate dashboard renders through the shell with real StatCard metric tiles', async ({ page }) => {
    const s = seed();
    await loginCandidate(page, s.candidate.email, s.password);

    await expect(page.getByRole('heading', { name: 'Candidate dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find Jobs' })).toHaveAttribute('href', '/candidate/jobs');
    await expect(page.getByText('Application summary')).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
  });

  test('recruiter home renders through the shell, and the nav rail expands/pins/persists across a real navigation', async ({ page }) => {
    const s = seed();
    await loginRecruiter(page, s.recruiter.email, s.password);

    await expect(page.getByRole('link', { name: 'Post a Job' })).toBeVisible();

    // Collapsed by default: no expanded-rail landmark yet.
    await expect(page.getByRole('complementary', { name: 'Expanded navigation' })).toHaveCount(0);

    // Click-expand and pin, matching the shared collapsible-rail primitive.
    await page.getByRole('button', { name: 'Expand navigation' }).click();
    await expect(page.getByRole('complementary', { name: 'Expanded navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unpin navigation' })).toHaveAttribute('aria-pressed', 'true');

    // A real, full navigation to another sidebarCollapsible-enabled page -
    // the pinned preference is persisted via localStorage (see
    // useCollapsibleRail), not React state, so it must survive a fresh
    // page load/hydration cycle, not just a client-side transition. Most
    // other authenticated routes deliberately keep their existing
    // non-collapsible sidebar (out of U4's scope), so this checks against
    // another of the four pages that do have it.
    await page.goto('/recruiter/database/results', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('complementary', { name: 'Expanded navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unpin navigation' })).toHaveAttribute('aria-pressed', 'true');
  });

  // The Resume Search V2 filter rail's collapse/expand/persistence behavior
  // (U3) is not smoke-tested live here: the page sits behind a controlled
  // server-side rollout gate (NEXT_PUBLIC_FEATURE_RESUME_SEARCH_V2, a
  // build-time flag, plus a user/org allowlist) that must not be toggled
  // just to exercise a test - see resume-search-v2-rollout.server.js. That
  // exact behavior is already exhaustively covered by 12 passing
  // component-level tests (recruiter-resume-search-v2-page.test.jsx) with
  // the feature explicitly enabled via props, independent of the live
  // rollout flag.

  test('admin overview renders through the shell with real StatCard metrics', async ({ page }) => {
    // Login itself is role-agnostic (any account authenticates through the
    // same form/endpoint); only the post-login redirect differs by role,
    // so the candidate-branded login page's form works fine here too.
    await page.goto('/auth/candidate/login', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/^email$/i).first().fill('e2e.fictional.admin@careeriz.demo');
    await form.getByLabel(/^password$/i).first().fill('FictionalE2EPass123!');
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 30000 });

    await expect(page.getByRole('heading', { name: /Operate the organization platform/i })).toBeVisible();
    await expect(page.getByText('Active members')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' }).first()).toHaveAttribute('href', '/admin/users');
  });
});
