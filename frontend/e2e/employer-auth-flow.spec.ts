import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// CAREERIZ EMPLOYER-LOGIN-FLOW-VERIFIED - focused browser coverage for the
// employer-type-selection gate and the employer login journey. Fictional
// accounts only, seeded fresh per run - never touches a real user or a
// real password.

type SeedResult = {
  password: string;
  recruiter: { email: string; userId: string };
  recruiterMustChange: { email: string; userId: string };
  candidate: { email: string; userId: string };
  organisation: { id: string; slug: string };
};

const seedScript = path.resolve(process.cwd(), '../backend/scripts/seed-employer-auth-e2e.mjs');

function seed(): SeedResult {
  return JSON.parse(execFileSync('node', [seedScript], { encoding: 'utf8' }).trim()) as SeedResult;
}

test.describe('Employer login journey - selection gate', () => {
  test('homepage "Continue as Employer" reaches the employer chooser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /continue as employer/i }).click();
    await expect(page).toHaveURL(/\/hire$/);
    await expect(page.getByRole('heading', { name: /consultancy recruiter/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /company recruiter/i })).toBeVisible();
  });

  test('header "Careeriz Hire" reaches the employer chooser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Careeriz Hire' }).first().click();
    await expect(page).toHaveURL(/\/hire$/);
    await expect(page.getByRole('heading', { name: /consultancy recruiter/i })).toBeVisible();
  });

  test('direct /hire/login without employerType redirects to /hire, not a generic form', async ({ page }) => {
    await page.goto('/hire/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hire$/);
    await expect(page.getByRole('heading', { name: /consultancy recruiter/i })).toBeVisible();
  });

  test('direct /hire/register without employerType redirects to /hire', async ({ page }) => {
    await page.goto('/hire/register', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hire$/);
    await expect(page.getByRole('heading', { name: /company recruiter/i })).toBeVisible();
  });

  test('an invalid employerType value is rejected, not silently accepted', async ({ page }) => {
    await page.goto('/hire/login?employerType=ADMIN', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hire$/);
  });

  test('a safe next survives the round trip through the chooser', async ({ page }) => {
    await page.goto('/hire/login?next=%2Frecruiter%2Fjobs', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hire\?next=%2Frecruiter%2Fjobs$/);
    const consultancyLogin = page.getByRole('link', { name: 'Log in' }).first();
    await expect(consultancyLogin).toHaveAttribute('href', /next=%2Frecruiter%2Fjobs/);
  });

  test('an external open-redirect next value is dropped, not preserved', async ({ page }) => {
    await page.goto('/hire/login?next=https%3A%2F%2Fevil.example.com', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hire$/);
    const consultancyLogin = page.getByRole('link', { name: 'Log in' }).first();
    await expect(consultancyLogin).not.toHaveAttribute('href', /evil\.example\.com/);
  });
});

test.describe('Employer login journey - authentication', () => {
  test('consultancy recruiter can log in by clicking Sign in and lands in the recruiter workspace', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=CONSULTANCY', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/consultancy recruiter/i).first()).toBeVisible();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /recruiter home/i })).toBeVisible();
  });

  test('company recruiter can log in and lands in the recruiter workspace (login is type-agnostic by design)', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=COMPANY', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/company recruiter/i).first()).toBeVisible();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /recruiter home/i })).toBeVisible();
  });

  test('pressing Enter in the password field submits the form, same as clicking Sign in', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=CONSULTANCY', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByLabel(/^password$/i).first().press('Enter');
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /recruiter home/i })).toBeVisible();
  });

  test('invalid credentials show a generic message, not an account-existence hint, and do not redirect', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=CONSULTANCY', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill('DefinitelyWrongPassword999');
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/hire\/login/);
    await expect(page.getByText(/no account|does not exist/i)).toHaveCount(0);
  });

  test('a forced-password-change recruiter is sent to the change-password page after login', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=CONSULTANCY', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiterMustChange.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/change-password', { timeout: 30000 });
  });

  test('an open-redirect next is rejected end-to-end: post-login lands on the recruiter home, not the external URL', async ({ page }) => {
    const s = seed();
    await page.goto('/hire/login?employerType=CONSULTANCY&next=https%3A%2F%2Fevil.example.com', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
    expect(page.url()).not.toContain('evil.example.com');
  });

  test('candidate login is unaffected by the employer-type gate', async ({ page }) => {
    const s = seed();
    await page.goto('/auth/candidate/login', { waitUntil: 'domcontentloaded' });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/^email$/i).first().fill(s.candidate.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/candidate/dashboard', { timeout: 30000 });
  });
});

test.describe('Employer login journey - mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile: hamburger menu reaches the employer chooser, and login succeeds', async ({ page }) => {
    const s = seed();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    await page.getByRole('banner').getByRole('link', { name: 'Careeriz Hire' }).click();
    await expect(page).toHaveURL(/\/hire$/);
    await expect(page.getByRole('heading', { name: /consultancy recruiter/i })).toBeVisible();

    await page.getByRole('link', { name: 'Log in' }).first().click();
    await expect(page).toHaveURL(/employerType=CONSULTANCY/);

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: /^sign in$/i }) });
    await form.getByLabel(/work email|email/i).first().fill(s.recruiter.email);
    await form.getByLabel(/^password$/i).first().fill(s.password);
    await form.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => url.pathname === '/recruiter/home', { timeout: 30000 });
  });
});
