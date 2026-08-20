import { execFileSync } from 'node:child_process';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { expect, test } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';

type SeedResult = {
  password: string;
  candidateA: { email: string; fullName: string; userId: string };
  candidateB: { email: string; fullName: string; userId: string };
  recruiterA: { email: string; fullName: string; userId: string };
};

const seedScript = path.resolve(process.cwd(), '../backend/scripts/seed-messaging-e2e.mjs');
const E2E_JWT_SECRET = 'careeriz-messaging-phase1-e2e-secret-123456';

function reseed(): SeedResult {
  return JSON.parse(execFileSync('node', [seedScript], { encoding: 'utf8' }).trim()) as SeedResult;
}

async function waitForHydratedAuthForm(page) {
  await expect(page.getByRole('heading', { name: /welcome back/i }).first()).toBeVisible();
  await expect(page.getByLabel(/^Password$/i).first()).toBeVisible();
  await expect(page.getByLabel(/show password/i).first()).toBeVisible();

  const passwordField = page.getByLabel(/^Password$/i).first();
  await expect(passwordField).toHaveAttribute('type', 'password');
  await page.getByLabel(/show password/i).first().click();
  await expect(passwordField).toHaveAttribute('type', 'text');
  await page.getByLabel(/hide password/i).first().click();
  await expect(passwordField).toHaveAttribute('type', 'password');
}

async function login(page, loginPath: string, email: string, password: string, expectedPath: string) {
  await page.goto(loginPath, { waitUntil: 'domcontentloaded' });
  await waitForHydratedAuthForm(page);
  await page.getByRole('textbox', { name: /email|work email/i }).first().fill(email);
  await page.getByLabel(/^Password$/i).first().fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).first().click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: expectedPath.endsWith('/messages') ? /^Messages$/i : /professional network/i })).toBeVisible();
}

async function expectNetworkPage(page, audience: 'candidate' | 'recruiter') {
  const heading = audience === 'candidate'
    ? /build your professional network/i
    : /manage your professional network/i;
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

async function logout(page) {
  await page.request.post('/api/auth/logout').catch(() => null);
  await page.context().clearCookies().catch(() => null);
}

async function openMessageFromConnection(page, targetUserId: string) {
  const messageLink = page.locator(`a[href*="?user=${targetUserId}"]`).filter({ hasText: /^Message$/ }).first();
  await expect(messageLink).toBeVisible();
  await messageLink.click();
  await page.waitForURL((url) => url.pathname.endsWith('/messages'), { timeout: 45000 });
  await expect(page.getByRole('heading', { name: /^Messages$/i })).toBeVisible({ timeout: 45000 });
}

function getConversationRow(page, participantName: string) {
  return page.getByRole('button').filter({ hasText: participantName }).first();
}

function getUnreadBadge(conversationRow) {
  return conversationRow.getByTestId(/conversation-unread-badge-/);
}

function getMessageLog(page) {
  return page.getByRole('log', { name: /conversation messages/i });
}

async function sendMessage(page, text: string) {
  const composer = page.getByLabel(/message composer/i);
  await composer.fill(text);
  await page.getByRole('button', { name: /^Send$/i }).click();
  await expect(getMessageLog(page).getByText(text)).toBeVisible();
}

async function createBackendApiContext(userId: string) {
  const token = jwt.sign(
    { userId, sessionVersion: 0 },
    E2E_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '8h' }
  );
  return playwrightRequest.newContext({
    baseURL: 'http://127.0.0.1:5001/api/',
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function getConversationByParticipant(apiContext, participantName: string) {
  const response = await apiContext.get('messages/conversations');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const conversation = body.data.find((item: any) => item.participant.fullName === participantName);
  expect(conversation).toBeTruthy();
  return conversation;
}

async function expectConversationOrder(page, expectedNames: string[]) {
  const rows = await page.locator('[data-testid^="conversation-row-"]').allTextContents();
  const normalized = rows.map((item) => item.replace(/\s+/g, ' ').trim());
  expect(normalized.length).toBeGreaterThanOrEqual(expectedNames.length);
  expectedNames.forEach((name, index) => {
    expect(normalized[index]).toContain(name);
  });
}

test.describe.serial('Careeriz Messaging Phase 1 browser E2E', () => {
  test('candidate to recruiter flow clears unread and keeps duplicate conversation creation idempotent', async ({ browser }) => {
    test.setTimeout(240000);
    const seed = reseed();
    const candidateA = await browser.newPage();
    const recruiterA = await browser.newPage();
    const candidateAApi = await createBackendApiContext(seed.candidateA.userId);

    try {
      await login(candidateA, '/auth/candidate/login?next=/candidate/network', seed.candidateA.email, seed.password, '/candidate/network');
      await expectNetworkPage(candidateA, 'candidate');

      await openMessageFromConnection(candidateA, seed.recruiterA.userId);
      const candidateToRecruiterText = `Candidate A to recruiter ${Date.now()}`;
      await sendMessage(candidateA, candidateToRecruiterText);

      const recruiterConversation = await getConversationByParticipant(candidateAApi, seed.recruiterA.fullName);
      const recruiterConversationId = recruiterConversation.id;

      await login(recruiterA, '/hire/login?employerType=CONSULTANCY&next=/recruiter/messages', seed.recruiterA.email, seed.password, '/recruiter/messages');
      const recruiterConversationButton = getConversationRow(recruiterA, seed.candidateA.fullName);
      await expect(getUnreadBadge(recruiterConversationButton)).toHaveText('1');
      await recruiterConversationButton.click();
      await expect(getMessageLog(recruiterA).getByText(candidateToRecruiterText)).toBeVisible();
      await expect(getUnreadBadge(recruiterConversationButton)).toHaveCount(0, { timeout: 20000 });

      const recruiterReplyText = `Recruiter reply ${Date.now()}`;
      await sendMessage(recruiterA, recruiterReplyText);
      await expect(getMessageLog(candidateA).getByText(recruiterReplyText)).toBeVisible({ timeout: 20000 });

      await candidateA.goto('/candidate/network', { waitUntil: 'domcontentloaded' });
      await expectNetworkPage(candidateA, 'candidate');
      await openMessageFromConnection(candidateA, seed.recruiterA.userId);
      const repeatConversation = await getConversationByParticipant(candidateAApi, seed.recruiterA.fullName);
      expect(repeatConversation.id).toBe(recruiterConversationId);

      await candidateA.goto(`/network/people/${seed.recruiterA.userId}`, { waitUntil: 'domcontentloaded' });
      const recruiterProfileMessageLink = candidateA.getByTestId(`network-message-${seed.recruiterA.userId}`);
      await expect(recruiterProfileMessageLink).toBeVisible();
      await recruiterProfileMessageLink.click();
      await expect(candidateA.getByRole('heading', { name: /^Messages$/i })).toBeVisible();
      const profileConversation = await getConversationByParticipant(candidateAApi, seed.recruiterA.fullName);
      expect(profileConversation.id).toBe(recruiterConversationId);
    } finally {
      await candidateAApi.dispose();
      await logout(candidateA);
      await logout(recruiterA);
      await candidateA.close();
      await recruiterA.close();
    }
  });

  test('candidate to candidate flow clears unread and block disables further messaging', async ({ browser }) => {
    test.setTimeout(240000);
    const seed = reseed();
    const candidateA = await browser.newPage();
    const candidateB = await browser.newPage();
    const candidateAApi = await createBackendApiContext(seed.candidateA.userId);

    try {
      await login(candidateA, '/auth/candidate/login?next=/candidate/network', seed.candidateA.email, seed.password, '/candidate/network');
      await expectNetworkPage(candidateA, 'candidate');
      await openMessageFromConnection(candidateA, seed.candidateB.userId);

      const candidateToCandidateText = `Candidate A to candidate B ${Date.now()}`;
      await sendMessage(candidateA, candidateToCandidateText);

      await login(candidateB, '/auth/candidate/login?next=/candidate/messages', seed.candidateB.email, seed.password, '/candidate/messages');
      const candidateBConversationButton = getConversationRow(candidateB, seed.candidateA.fullName);
      await expect(getUnreadBadge(candidateBConversationButton)).toHaveText('1');
      await candidateBConversationButton.click();
      await expect(getMessageLog(candidateB).getByText(candidateToCandidateText)).toBeVisible();
      await expect(getUnreadBadge(candidateBConversationButton)).toHaveCount(0, { timeout: 20000 });

      const candidateBReplyText = `Candidate B reply ${Date.now()}`;
      await sendMessage(candidateB, candidateBReplyText);
      await expect(getMessageLog(candidateA).getByText(candidateBReplyText)).toBeVisible({ timeout: 20000 });

      const candidateBConversation = await getConversationByParticipant(candidateAApi, seed.candidateB.fullName);

      await candidateB.goto('/candidate/network', { waitUntil: 'domcontentloaded' });
      await expectNetworkPage(candidateB, 'candidate');
      const candidateABlockButton = candidateB.getByTestId(`network-block-${seed.candidateA.userId}`).first();
      await expect(candidateABlockButton).toBeVisible({ timeout: 30000 });
      await expect(candidateABlockButton).toBeEnabled({ timeout: 30000 });
      await candidateABlockButton.click();
      await expect(candidateB.getByTestId(`network-block-${seed.candidateA.userId}`)).toHaveCount(0, { timeout: 30000 });

      await candidateA.goto('/candidate/messages', { waitUntil: 'domcontentloaded' });
      await expect(candidateA.getByRole('heading', { name: /^Messages$/i })).toBeVisible();
      const candidateBConversationAfterBlock = getConversationRow(candidateA, seed.candidateB.fullName);
      await candidateBConversationAfterBlock.click();
      await expect(candidateA.getByText(/Messaging is currently unavailable/i)).toBeVisible();
      await expect(candidateA.getByRole('button', { name: /^Send$/i })).toHaveCount(0);
      await expect(candidateA.getByRole('button', { name: /^Attachment$/i })).toHaveCount(0);

      const blockedSendResponse = await candidateAApi.post(`messages/conversations/${candidateBConversation.id}/messages`, {
        multipart: { content: 'blocked bypass attempt' },
      });
      expect(blockedSendResponse.status()).toBe(403);
    } finally {
      await candidateAApi.dispose();
      await logout(candidateA);
      await logout(candidateB);
      await candidateA.close();
      await candidateB.close();
    }
  });

  test('recruiter to candidate flow clears unread and disconnect preserves history while disabling send', async ({ browser }) => {
    test.setTimeout(240000);
    const seed = reseed();
    const candidateA = await browser.newPage();
    const recruiterA = await browser.newPage();
    const candidateAApi = await createBackendApiContext(seed.candidateA.userId);

    try {
      await login(recruiterA, '/hire/login?employerType=CONSULTANCY&next=/recruiter/network', seed.recruiterA.email, seed.password, '/recruiter/network');
      await expectNetworkPage(recruiterA, 'recruiter');
      await openMessageFromConnection(recruiterA, seed.candidateA.userId);

      const recruiterToCandidateText = `Recruiter to candidate ${Date.now()}`;
      await sendMessage(recruiterA, recruiterToCandidateText);

      await login(candidateA, '/auth/candidate/login?next=/candidate/messages', seed.candidateA.email, seed.password, '/candidate/messages');
      const candidateARecruiterButton = getConversationRow(candidateA, seed.recruiterA.fullName);
      await expect(getUnreadBadge(candidateARecruiterButton)).toHaveText('1');
      await candidateARecruiterButton.click();
      await expect(getMessageLog(candidateA).getByText(recruiterToCandidateText)).toBeVisible();
      await expect(getUnreadBadge(candidateARecruiterButton)).toHaveCount(0, { timeout: 20000 });

      const recruiterConversation = await getConversationByParticipant(candidateAApi, seed.recruiterA.fullName);

      await candidateA.goto('/candidate/network', { waitUntil: 'domcontentloaded' });
      await expectNetworkPage(candidateA, 'candidate');
      const recruiterRemoveButton = candidateA.getByTestId(`network-remove-${seed.recruiterA.userId}`).first();
      await recruiterRemoveButton.click();
      await expect(candidateA.getByTestId(`network-message-${seed.recruiterA.userId}`).first()).toHaveCount(0, { timeout: 30000 });

      await candidateA.goto('/candidate/messages', { waitUntil: 'domcontentloaded' });
      await expect(candidateA.getByRole('heading', { name: /^Messages$/i })).toBeVisible();
      const recruiterConversationAfterDisconnect = getConversationRow(candidateA, seed.recruiterA.fullName);
      await recruiterConversationAfterDisconnect.click();
      await expect(getMessageLog(candidateA).getByText(recruiterToCandidateText)).toBeVisible();
      await expect(candidateA.getByText(/Messaging is currently unavailable/i)).toBeVisible();
      await expect(candidateA.getByRole('button', { name: /^Send$/i })).toHaveCount(0);
      await expect(candidateA.getByRole('button', { name: /^Attachment$/i })).toHaveCount(0);

      const disconnectedSendResponse = await candidateAApi.post(`messages/conversations/${recruiterConversation.id}/messages`, {
        multipart: { content: 'disconnect bypass attempt' },
      });
      expect(disconnectedSendResponse.status()).toBe(403);
    } finally {
      await candidateAApi.dispose();
      await logout(candidateA);
      await logout(recruiterA);
      await candidateA.close();
      await recruiterA.close();
    }
  });

  test('polling updates active conversations, unread badges, ordering, and avoids active polling when no conversation is open', async ({ browser }) => {
    test.setTimeout(180000);
    const seed = reseed();
    const candidateA = await browser.newPage();
    const candidateAApi = await createBackendApiContext(seed.candidateA.userId);
    const candidateBApi = await createBackendApiContext(seed.candidateB.userId);
    const recruiterAApi = await createBackendApiContext(seed.recruiterA.userId);

    try {
      const recruiterConversationResponse = await candidateAApi.post('messages/conversations', {
        data: { participantUserId: seed.recruiterA.userId },
      });
      const recruiterConversation = (await recruiterConversationResponse.json()).data;
      await candidateAApi.post(`messages/conversations/${recruiterConversation.id}/messages`, {
        multipart: { content: 'Initial recruiter thread' },
      });

      const candidateBConversationResponse = await candidateAApi.post('messages/conversations', {
        data: { participantUserId: seed.candidateB.userId },
      });
      const candidateBConversation = (await candidateBConversationResponse.json()).data;
      await candidateAApi.post(`messages/conversations/${candidateBConversation.id}/messages`, {
        multipart: { content: 'Initial candidate B thread' },
      });

      const activeConversationRequests: string[] = [];
      candidateA.on('request', (request) => {
        if (request.url().includes('/api/messages/conversations/')) {
          activeConversationRequests.push(request.url());
        }
      });

      await login(candidateA, '/auth/candidate/login?next=/candidate/messages', seed.candidateA.email, seed.password, '/candidate/messages');
      const baselineActiveConversationRequestCount = activeConversationRequests.length;
      await expect.poll(() => activeConversationRequests.length, { timeout: 17000 }).toBe(baselineActiveConversationRequestCount);

      await getConversationRow(candidateA, seed.candidateB.fullName).click();
      await expect(getMessageLog(candidateA).getByText('Initial candidate B thread')).toBeVisible();

      await recruiterAApi.post(`messages/conversations/${recruiterConversation.id}/messages`, {
        multipart: { content: 'Recruiter polling message' },
      });
      await candidateBApi.post(`messages/conversations/${candidateBConversation.id}/messages`, {
        multipart: { content: 'Candidate B polling reply' },
      });

      await expect(getMessageLog(candidateA).getByText('Candidate B polling reply')).toBeVisible({ timeout: 25000 });
      const recruiterRow = candidateA.getByTestId(`conversation-row-${recruiterConversation.id}`);
      await expect(recruiterRow.getByTestId(`conversation-unread-badge-${recruiterConversation.id}`)).toHaveText('1', { timeout: 25000 });
      await expectConversationOrder(candidateA, [seed.recruiterA.fullName, seed.candidateB.fullName]);
      await expect.poll(() => activeConversationRequests.length, { timeout: 17000 }).toBeGreaterThan(baselineActiveConversationRequestCount);
    } finally {
      await candidateAApi.dispose();
      await candidateBApi.dispose();
      await recruiterAApi.dispose();
      await logout(candidateA);
      await candidateA.close();
    }
  });
});
