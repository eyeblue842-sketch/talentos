import { beforeEach, describe, expect, test, vi } from 'vitest';

const cookieSetMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

async function loadGoogleStartRoute() {
  return import('@/app/api/auth/google/route');
}

async function loadGoogleCallbackRoute() {
  return import('@/app/api/auth/google/callback/route');
}

describe('Google auth routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:5000/api';
    cookieSetMock.mockReset();
    cookiesMock.mockResolvedValue({ set: cookieSetMock });
    global.fetch = vi.fn();
  });

  test('google auth start route redirects to backend OAuth start without using NEXT_PUBLIC_API_BASE_URL', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000/api';
    const { GET } = await loadGoogleStartRoute();
    const response = await GET({
      nextUrl: new URL('http://localhost:3000/api/auth/google?mode=signup&next=/candidate/onboarding'),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:5000/api/auth/oauth/google/start?role=CANDIDATE&mode=signup&next=%2Fcandidate%2Fonboarding',
    );
  });

  test('google callback route redirects with a clear error when code is missing', async () => {
    const { GET } = await loadGoogleCallbackRoute();
    const response = await GET({
      nextUrl: new URL('http://localhost:3000/api/auth/google/callback'),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/candidate/login?oauthError=Invalid+Google+OAuth+callback.');
  });

  test('google callback route exchanges code with backend and sets the session cookie', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          token: 'oauth-session-token',
          nextPath: '/candidate/onboarding',
        },
      }),
    });

    const { GET } = await loadGoogleCallbackRoute();
    const response = await GET({
      nextUrl: new URL('http://localhost:3000/api/auth/google/callback?code=oauth-code&state=oauth-state-token-12345678901234567890'),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/auth/oauth/callback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'google',
          code: 'oauth-code',
          state: 'oauth-state-token-12345678901234567890',
        }),
      }),
    );
    expect(cookieSetMock).toHaveBeenCalledWith(
      'careeriz_session',
      'oauth-session-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(response.headers.get('location')).toBe('http://localhost:3000/candidate/onboarding');
  });
});
