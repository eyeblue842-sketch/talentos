import { beforeEach, describe, expect, test, vi } from 'vitest';

const redirectMock = vi.fn((path) => {
  throw new Error(`REDIRECT:${path}`);
});

const cookiesMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

async function loadAuthModule() {
  return import('@/lib/auth');
}

function mockSessionCookie(token = 'session-token') {
  cookiesMock.mockResolvedValue({
    get: vi.fn((name) => (name === 'careeriz_session' ? { value: token } : undefined)),
  });
}

describe('auth session routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  test('redirects authenticated recruiter sessions away from /auth and / to recruiter workspace', async () => {
    mockSessionCookie();
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'user-1', email: 'recruiter@example.com', role: 'RECRUITER' } }),
    });

    const { redirectIfAuthenticated } = await loadAuthModule();

    await expect(redirectIfAuthenticated()).rejects.toThrow('REDIRECT:/recruiter');
  });

  test('redirects authenticated candidate sessions away from /auth and / to candidate workspace', async () => {
    mockSessionCookie();
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'user-2', email: 'candidate@example.com', role: 'CANDIDATE' } }),
    });

    const { redirectIfAuthenticated } = await loadAuthModule();

    await expect(redirectIfAuthenticated()).rejects.toThrow('REDIRECT:/candidate/dashboard');
  });

  test('candidate-only guards redirect recruiter sessions without rendering candidate pages', async () => {
    mockSessionCookie();
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'user-1', email: 'recruiter@example.com', role: 'RECRUITER' } }),
    });

    const { requireUser } = await loadAuthModule();

    await expect(requireUser('CANDIDATE')).rejects.toThrow('REDIRECT:/recruiter');
  });

  test('recruiter-only guards redirect candidate sessions without rendering recruiter pages', async () => {
    mockSessionCookie();
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'user-2', email: 'candidate@example.com', role: 'CANDIDATE' } }),
    });

    const { requireUser } = await loadAuthModule();

    await expect(requireUser('RECRUITER')).rejects.toThrow('REDIRECT:/candidate/dashboard');
  });

  test('missing sessions redirect to auth safely', async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });

    const { requireUser } = await loadAuthModule();

    await expect(requireUser('CANDIDATE')).rejects.toThrow('REDIRECT:/auth');
  });
});
