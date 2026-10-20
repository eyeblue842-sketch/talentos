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

  test('missing token goes to the verify-email page as an error, without calling the backend', async () => {
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth/verify-email');
    expect(location.searchParams.get('status')).toBe('error');
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

  test('a verified token with no stored "next" lands on the verified confirmation page', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: null, audience: 'employer' } });
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=sometoken'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth/verify-email');
    expect(location.searchParams.get('status')).toBe('success');
    expect(location.searchParams.get('audience')).toBe('employer');
  });

  test('an unsafe stored "next" (open-redirect attempt) is rejected and falls back to the verified page', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: '//evil.example.com/steal' } });
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=sometoken'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth/verify-email');
    expect(location.host).toBe('localhost:3000');
  });

  test('redirects use the forwarded public host, never the container bind address', async () => {
    requestBackend.mockResolvedValue({ success: true, data: { verified: true, next: null } });
    const { GET } = await import('./route.js');
    const request = {
      nextUrl: new URL('http://0.0.0.0:3000/api/auth/email-verification/confirm?token=sometoken'),
      headers: new Headers({ host: 'www.careeriz.com', 'x-forwarded-proto': 'https' }),
    };
    const response = await GET(request);

    expect(response.headers.get('location')).toMatch(/^https:\/\/www\.careeriz\.com\/auth\/verify-email/);
  });

  test('an invalid/expired token goes to the verify-email error page and never echoes the raw token', async () => {
    requestBackend.mockRejectedValue(Object.assign(new Error('Invalid or expired token.'), { statusCode: 400 }));
    const { GET } = await import('./route.js');
    const response = await GET(fakeRequest('http://localhost:3000/api/auth/email-verification/confirm?token=super-secret-raw-token'));

    const location = new URL(response.headers.get('location'));
    expect(location.pathname).toBe('/auth/verify-email');
    expect(location.searchParams.get('status')).toBe('error');
    expect(response.headers.get('location')).not.toContain('super-secret-raw-token');
  });
});
