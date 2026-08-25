import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

// Full password-recovery journey (request -> non-enumerating confirmation ->
// real SMTP-delivered link -> single-use reset session -> emailed OTP ->
// new password -> portal-specific redirect -> session revocation) exercised
// against all three login portals: candidate, consultancy recruiter, and
// company recruiter. Emails are read back from a real local SMTP catcher
// (backend/scripts/e2e-smtp-catcher.mjs, wired as a Playwright webServer),
// not an in-memory mock - see start-e2e-server.mjs for how the e2e backend
// is pointed at it.

const CATCHER_HTTP_BASE = 'http://127.0.0.1:2526';
const seedScript = path.resolve(process.cwd(), '../backend/scripts/seed-employer-auth-e2e.mjs');

type SeedResult = {
  password: string;
  recruiter: { email: string };
  candidate: { email: string };
};

function seed(): SeedResult {
  return JSON.parse(execFileSync('node', [seedScript], { encoding: 'utf8' }).trim()) as SeedResult;
}

async function resetCatcher() {
  await fetch(`${CATCHER_HTTP_BASE}/reset`, { method: 'POST' });
}

async function latestEmailFor(email: string): Promise<{ subject: string; text: string }> {
  const response = await fetch(`${CATCHER_HTTP_BASE}/messages?to=${encodeURIComponent(email)}`);
  const messages = (await response.json()) as Array<{ subject: string; text: string }>;
  const message = messages.at(-1);
  if (!message) {
    throw new Error(`No email captured for ${email}`);
  }
  return message;
}

async function emailCountFor(email: string): Promise<number> {
  const response = await fetch(`${CATCHER_HTTP_BASE}/messages?to=${encodeURIComponent(email)}`);
  const messages = await response.json();
  return messages.length;
}

function extractResetToken(text: string): string {
  const match = text.match(/token=([a-f0-9]{20,})/);
  if (!match) throw new Error(`No reset token found in email text: ${text}`);
  return match[1];
}

function extractOtpCode(text: string): string {
  const match = text.match(/verification code is (\d{6})/);
  if (!match) throw new Error(`No OTP code found in email text: ${text}`);
  return match[1];
}

// Root-cause fix for a real hydration race, not a timeout workaround.
//
// Playwright's fill() sets an input's DOM value directly via the native
// value setter and dispatches an 'input' event. If a Next.js client
// component has not hydrated yet, there is no React onChange listener
// attached to catch that event, so the component's controlled state never
// updates - the DOM shows the typed value, but React still thinks the
// field is empty. The value only visibly breaks once hydration actually
// runs: React's hydration commit reconciles the input against its own
// (still-empty) state and overwrites the DOM value back to "". That reset
// can happen at any point between the fill() call and the eventual submit
// click, so checking the value immediately after fill() proves nothing -
// the only reliable check is immediately before submitting, since that is
// exactly when a stale-vs-hydrated field would diverge. If it has reset,
// re-running the whole fill (now that hydration has necessarily finished)
// fixes it, which is what fillFieldsThenSubmit below verifies and retries.
// Once every field's value is confirmed (toHaveValue passing means React's
// onChange actually ran, which is only possible post-hydration), hydration
// cannot un-happen - so clicking immediately afterward is safe. Each retry
// re-fills every field from scratch, so a mid-attempt reset simply gets
// corrected on the next pass instead of silently submitting stale values.
async function fillFieldsThenSubmit(fields: Array<{ locator: Locator; value: string }>, submit: Locator) {
  await expect(async () => {
    for (const { locator, value } of fields) {
      await locator.fill(value);
    }
    for (const { locator, value } of fields) {
      await expect(locator).toHaveValue(value);
    }
    await submit.click();
  }).toPass({ timeout: 15000 });
}

async function requestReset(page: Page, forgotPasswordUrl: string, email: string) {
  await page.goto(forgotPasswordUrl, { waitUntil: 'domcontentloaded' });
  // A cold-started standalone server's very first request can serve HTML
  // before client hydration has attached handlers - waiting for the button
  // itself (not just DOM content) avoids filling/clicking a not-yet-
  // interactive form. See employer-auth-flow.spec.ts / dashboard-modernization
  // smoke tests for the same fix applied to this exact class of flake.
  const submit = page.getByRole('button', { name: /send reset link/i });
  await submit.waitFor({ state: 'visible' });
  await fillFieldsThenSubmit([{ locator: page.getByLabel(/email/i), value: email }], submit);
  await expect(page.getByText(/if an account exists for that email/i)).toBeVisible();
}

async function followResetLinkAndVerifyOtp(page: Page, email: string) {
  const linkEmail = await latestEmailFor(email);
  expect(linkEmail.subject).toMatch(/reset your careeriz password/i);
  const token = extractResetToken(linkEmail.text);

  await page.goto(`/api/auth/password-reset/start?token=${token}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/auth\/reset-password/);
  await expect(page.getByText(/invalid or has expired/i)).toHaveCount(0);

  const otpEmail = await latestEmailFor(email);
  expect(otpEmail.subject).toMatch(/verification code/i);
  const code = extractOtpCode(otpEmail.text);

  const verify = page.getByRole('button', { name: /verify code/i });
  await verify.waitFor({ state: 'visible' });
  await fillFieldsThenSubmit([{ locator: page.getByLabel(/6-digit code/i), value: code }], verify);
  await expect(page.getByLabel(/^new password$/i)).toBeVisible();
}

async function setNewPassword(page: Page, newPassword: string) {
  const submit = page.getByRole('button', { name: /set new password/i });
  await fillFieldsThenSubmit([
    { locator: page.getByLabel(/^new password$/i), value: newPassword },
    { locator: page.getByLabel(/confirm new password/i), value: newPassword },
  ], submit);
  await expect(page.getByText(/password reset complete/i)).toBeVisible();
}

test.describe('Password recovery: email link + OTP, all three portals', () => {
  test('candidate: full reset journey, portal-correct redirect, new password works, old password rejected, other sessions revoked', async ({ browser }) => {
    const s = seed();
    await resetCatcher();

    // A pre-existing authenticated session in a separate context, used at
    // the end to prove the reset revokes it (sessionVersion bump), not just
    // that the new password works.
    const priorSessionContext = await browser.newContext();
    const priorSessionPage = await priorSessionContext.newPage();
    await priorSessionPage.goto('/auth/candidate/login', { waitUntil: 'domcontentloaded' });
    await priorSessionPage.getByRole('button', { name: /^sign in$/i }).first().waitFor({ state: 'visible' });
    const priorForm = priorSessionPage.locator('form').filter({ has: priorSessionPage.getByRole('button', { name: /^sign in$/i }) });
    await fillFieldsThenSubmit([
      { locator: priorForm.getByLabel(/^email$/i), value: s.candidate.email },
      { locator: priorForm.getByLabel(/^password$/i), value: s.password },
    ], priorForm.getByRole('button', { name: /^sign in$/i }));
    await priorSessionPage.waitForURL((url) => url.pathname === '/candidate/dashboard', { timeout: 30000 });

    const context = await browser.newContext();
    const page = await context.newPage();

    await requestReset(page, '/auth/candidate/forgot-password', s.candidate.email);
    await followResetLinkAndVerifyOtp(page, s.candidate.email);

    const newPassword = 'BrandNewCandidatePass123!';
    await setNewPassword(page, newPassword);
    await page.waitForURL((url) => url.pathname === '/auth/candidate/login' && url.searchParams.get('resetSuccess') === '1', { timeout: 15000 });

    // Old password rejected.
    const loginForm = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await fillFieldsThenSubmit([
      { locator: loginForm.getByLabel(/^email$/i), value: s.candidate.email },
      { locator: loginForm.getByLabel(/^password$/i), value: s.password },
    ], loginForm.getByRole('button', { name: /^sign in$/i }));
    await expect(page.getByText(/authentication issue/i)).toBeVisible();

    // New password works.
    await fillFieldsThenSubmit([
      { locator: loginForm.getByLabel(/^password$/i), value: newPassword },
    ], loginForm.getByRole('button', { name: /^sign in$/i }));
    await page.waitForURL((url) => url.pathname === '/candidate/dashboard', { timeout: 30000 });

    // The session that was live BEFORE the reset is now revoked.
    await priorSessionPage.goto('/candidate/dashboard', { waitUntil: 'domcontentloaded' });
    await priorSessionPage.waitForURL((url) => url.pathname !== '/candidate/dashboard', { timeout: 15000 });

    await context.close();
    await priorSessionContext.close();
  });

  test('consultancy recruiter: full reset journey redirects back to /hire/login with employerType=CONSULTANCY', async ({ page }) => {
    const s = seed();
    await resetCatcher();

    await requestReset(page, '/hire/forgot-password?employerType=CONSULTANCY', s.recruiter.email);
    await followResetLinkAndVerifyOtp(page, s.recruiter.email);

    const newPassword = 'BrandNewConsultancyPass123!';
    await setNewPassword(page, newPassword);
    await page.waitForURL((url) => (
      url.pathname === '/hire/login'
      && url.searchParams.get('employerType') === 'CONSULTANCY'
      && url.searchParams.get('resetSuccess') === '1'
    ), { timeout: 15000 });

    const loginForm = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await fillFieldsThenSubmit([
      { locator: loginForm.getByLabel(/work email|email/i).first(), value: s.recruiter.email },
      { locator: loginForm.getByLabel(/^password$/i), value: newPassword },
    ], loginForm.getByRole('button', { name: /^sign in$/i }));
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
  });

  test('company recruiter: full reset journey redirects back to /hire/login with employerType=COMPANY', async ({ page }) => {
    const s = seed();
    await resetCatcher();

    await requestReset(page, '/hire/forgot-password?employerType=COMPANY', s.recruiter.email);
    await followResetLinkAndVerifyOtp(page, s.recruiter.email);

    const newPassword = 'BrandNewCompanyPass123!';
    await setNewPassword(page, newPassword);
    await page.waitForURL((url) => (
      url.pathname === '/hire/login'
      && url.searchParams.get('employerType') === 'COMPANY'
      && url.searchParams.get('resetSuccess') === '1'
    ), { timeout: 15000 });

    const loginForm = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await fillFieldsThenSubmit([
      { locator: loginForm.getByLabel(/work email|email/i).first(), value: s.recruiter.email },
      { locator: loginForm.getByLabel(/^password$/i), value: newPassword },
    ], loginForm.getByRole('button', { name: /^sign in$/i }));
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
  });

  test('security: non-enumerating confirmation for an unknown email (no email actually sent), wrong OTP rejected, resend issues a working new code', async ({ page }) => {
    const s = seed();
    await resetCatcher();

    const unknownEmail = 'no-such-account@careeriz.demo';
    await requestReset(page, '/auth/candidate/forgot-password', unknownEmail);
    expect(await emailCountFor(unknownEmail)).toBe(0);

    await requestReset(page, '/auth/candidate/forgot-password', s.candidate.email);
    const linkEmail = await latestEmailFor(s.candidate.email);
    const token = extractResetToken(linkEmail.text);
    await page.goto(`/api/auth/password-reset/start?token=${token}`, { waitUntil: 'domcontentloaded' });

    const verify = page.getByRole('button', { name: /verify code/i });
    await verify.waitFor({ state: 'visible' });
    await fillFieldsThenSubmit([{ locator: page.getByLabel(/6-digit code/i), value: '000000' }], verify);
    await expect(page.getByText(/incorrect verification code/i)).toBeVisible();

    await page.getByRole('button', { name: /resend code/i }).click();
    await expect(page.getByText(/new verification code has been sent/i)).toBeVisible();

    const resentOtpEmail = await latestEmailFor(s.candidate.email);
    const resentCode = extractOtpCode(resentOtpEmail.text);
    await fillFieldsThenSubmit([{ locator: page.getByLabel(/6-digit code/i), value: resentCode }], verify);
    await expect(page.getByLabel(/^new password$/i)).toBeVisible();
  });

  test('an invalid/already-used reset link shows an error state instead of a form', async ({ page }) => {
    await page.goto('/api/auth/password-reset/start?token=not-a-real-token-not-a-real-token', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/reset-password\?resetError=1/);
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});
