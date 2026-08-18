import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// CAREERIZ PRODUCT INTEGRATION - Phase F: focused browser acceptance.
// Fictional accounts/data only. Never processes or references any
// protected/real production batch. Does not weaken auth/verification/
// entitlement/CSRF/tenant/rollout controls to make these pass.

type SeedResult = {
  password: string;
  verified: { email: string; organisationId: string };
  pending: { email: string; organisationId: string };
  consultancyRegisterEmailDomain: string;
  consultancyRegisterEmailGmail: string;
  companyRegisterEmailPublic: string;
  suffix: number;
};

const seedScript = path.resolve(process.cwd(), '../backend/scripts/pi-phase-f-seed.mjs');

function seed(): SeedResult {
  return JSON.parse(execFileSync('node', [seedScript], { encoding: 'utf8' }).trim()) as SeedResult;
}

async function login(page, email: string, password: string) {
  await page.goto('/hire/login', { waitUntil: 'domcontentloaded' });
  // The page also renders a "Work email" field for the password-reset
  // flow with the same accessible label - scope to the form that actually
  // contains the Sign In button to avoid filling the wrong one.
  const signInForm = page.locator('form').filter({ has: page.getByRole('button', { name: /^Sign in$/i }) });
  await signInForm.getByLabel(/work email|email/i).first().fill(email);
  await signInForm.getByLabel(/^Password$/i).first().fill(password);
  await signInForm.getByRole('button', { name: /^Sign in$/i }).first().click();
  // Wait for the actual post-login redirect (not just networkidle, which
  // can resolve mid-navigation and race a subsequent page.goto against the
  // in-flight Set-Cookie response).
  await page.waitForURL((url) => !url.pathname.startsWith('/hire/login'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

test.describe('CAREERIZ product integration - employer chooser and registration', () => {
  test('employer chooser shows Consultancy Recruiter and Company Recruiter cards', async ({ page }) => {
    await page.goto('/hire', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /consultancy recruiter/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /company recruiter/i })).toBeVisible();
  });

  test('consultancy recruiter can register with a business-domain email', async ({ page }) => {
    const s = seed();
    await page.goto(`/hire/register?employerType=CONSULTANCY`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/work email/i).first().fill(`fictional-owner-domain@${s.consultancyRegisterEmailDomain}`);
    await page.getByLabel(/^Password$/i).first().fill(s.password);
    await page.getByLabel(/confirm password/i).first().fill(s.password);
    await page.getByRole('button', { name: /create employer account/i }).first().click();
    await expect(page.getByText(/domain|consumer|disposable/i)).toHaveCount(0);
    await page.waitForLoadState('networkidle');
  });

  test('consultancy recruiter can register with a Gmail address', async ({ page }) => {
    const s = seed();
    await page.goto(`/hire/register?employerType=CONSULTANCY`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/work email/i).first().fill(s.consultancyRegisterEmailGmail);
    await page.getByLabel(/^Password$/i).first().fill(s.password);
    await page.getByLabel(/confirm password/i).first().fill(s.password);
    await page.getByRole('button', { name: /create employer account/i }).first().click();
    await page.waitForLoadState('networkidle');
    // A Gmail address must be ACCEPTED for Consultancy - no rejection banner.
    await expect(page.getByText(/company recruiter accounts require/i)).toHaveCount(0);
  });

  test('company recruiter public-email registration is safely rejected', async ({ page }) => {
    const s = seed();
    await page.goto(`/hire/register?employerType=COMPANY`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/work email/i).first().fill(s.companyRegisterEmailPublic);
    await page.getByLabel(/^Password$/i).first().fill(s.password);
    await page.getByLabel(/confirm password/i).first().fill(s.password);
    await page.getByRole('button', { name: /create employer account/i }).first().click();
    await expect(page.getByText(/consumer|personal email|verified official company email/i).first()).toBeVisible({ timeout: 15000 });
    // Never silently succeed - the URL must not have navigated away from registration.
    await expect(page).toHaveURL(/\/hire\/register/);
  });
});

test.describe('CAREERIZ product integration - pending-verification restrictions', () => {
  test('a PENDING company recruiter sees restricted access, not a silent unlock', async ({ page }) => {
    const s = seed();
    await login(page, s.pending.email, s.password);
    await page.goto('/recruiter/database/results?kw=MUST%3AKubernetes', { waitUntil: 'domcontentloaded' });
    // The pending org is allowlisted for Resume Search V2 rollout the same
    // as the verified org (see pi-e2e-resume-search-bootstrap.mjs), so
    // this reaches the real entitlement/verification-gated V2 endpoint
    // (auto-run from the URL's kw param, same as the verified-recruiter
    // search test below) rather than the unrelated legacy AI-search
    // fallback a non-allowlisted org would fall through to.
    // Scoped to the "Search unavailable" restriction heading, not a bare
    // keyword regex - the fictional org is itself literally named
    // "Fictional Pending Co", so a loose /pending/i match would resolve to
    // that (hidden, sidebar) text instead of the real restriction below it.
    await expect(page.getByRole('heading', { name: /search unavailable/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/verify|verification|subscription is required|not have access/i).first()).toBeVisible();
  });
});

test.describe('CAREERIZ product integration - verified recruiter pricing, search, and safety', () => {
  test('verified + subscribed recruiter can view the pricing/subscription page', async ({ page }) => {
    const s = seed();
    await login(page, s.verified.email, s.password);
    await page.goto('/recruiter/billing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/subscription|billing|plan/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('Resume Search V2 chips: optional, blue-star required, and excluded', async ({ page }) => {
    const s = seed();
    await login(page, s.verified.email, s.password);
    await page.goto('/recruiter/database', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /deterministic recruiter search/i })).toBeVisible({ timeout: 20000 });

    const input = page.getByPlaceholder(/Type `IT`, `Sales`/i);
    await input.fill('Kubernetes, AWS, "Frontend Engineer"');
    await input.press('Enter');

    await expect(page.getByText('Kubernetes', { exact: true })).toBeVisible();
    await expect(page.getByText('AWS', { exact: true })).toBeVisible();
    await expect(page.getByText('"Frontend Engineer"', { exact: true })).toBeVisible();

    // Optional (SHOULD) is the default state for a freshly-added chip.
    await expect(page.getByRole('button', { name: 'Optional keyword' }).first()).toBeVisible();

    // Toggle the first chip to Required (blue-star / MUST).
    const optionalStar = page.getByRole('button', { name: 'Optional keyword' }).first();
    await optionalStar.click();
    await expect(page.getByRole('button', { name: 'Required keyword' }).first()).toHaveAttribute('aria-pressed', 'true');

    // Exclude the phrase chip via its Actions menu.
    const actionsButtons = page.getByRole('button', { name: 'Actions' });
    await actionsButtons.last().click();
    await page.getByRole('menuitem', { name: 'Exclude keyword' }).click();
    await expect(page.getByText('Excluded').first()).toBeVisible();
  });

  test('search returns a safe result card with match explanation and no PII', async ({ page }) => {
    const s = seed();
    await login(page, s.verified.email, s.password);
    await page.goto('/recruiter/database/results?kw=MUST%3AKubernetes', { waitUntil: 'domcontentloaded' });

    const resultCard = page.getByText(/Priya Fictional Kapoor/i).first();
    await expect(resultCard).toBeVisible({ timeout: 20000 });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/priya\.fictional\.kapoor.*@/i);
    expect(bodyText).not.toMatch(/\+91\s*90000/);

    // Match explanation ("Matched required ... in ...") should be present
    // somewhere on the result card.
    await expect(page.getByText(/matched required|matched.*in/i).first()).toBeVisible();
  });
});
