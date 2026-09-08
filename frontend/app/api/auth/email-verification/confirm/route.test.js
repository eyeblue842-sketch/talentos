import { beforeEach, describe, expect, test, vi } from 'vitest';

const requestBackend = vi.fn();

vi.mock('@/lib/auth', () => ({
  requestBackend: (...args) => requestBackend(...args),
}));

function fakeRequest(url) {
  return { nextUrl: new URL(url) };
}

describe('GET /api/auth/email-verification/confirm', () => {
  beforeEach(() => {
    requestBackend.mockReset();
  });

  test('missing token redirects to /auth with an error, without calling the backend', async () => {
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth');
    expect(location.searchParams.get('oauthError')).toBeTruthy();
    expect(requestBackend).not.toHaveBeenCalled();
  });

  test('a verified token with a safe stored "next" redirects back to that destination (e.g. an invitation)', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: '/auth/invitations/accept?token=abc123' } });
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=sometoken'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth/invitations/accept');
    expect(location.searchParams.get('token')).toBe('abc123');
    expect(location.searchParams.get('authStatus')).toBe('email-verified');
  });

  test('a verified token with no stored "next" falls back to /auth', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: null } });
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=sometoken'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth');
    expect(location.searchParams.get('authStatus')).toBe('email-verified');
  });

  test('an unsafe stored "next" (open-redirect attempt) is rejected and falls back to /auth', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: '//evil.example.com/steal' } });
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=sometoken'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth');
    expect(location.host).toBe('localhost:3000');
  });

  test('an invalid/expired token redirects to /auth with a generic error that never echoes the raw token', async () => {
    requestBackend.mockRejectedValue(Object.assign(new Error('Invalid or expired token.'), { statusCode: 400 }));
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=super-secret-raw-token'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth');
    expect(location.searchParams.get('oauthError')).toBe('Invalid or expired token.');
    expect(response.headers.get('location')).not.toContain('super-secret-raw-token');
  });
});
