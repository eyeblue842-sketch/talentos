import { beforeEach, describe, expect, test, vi } from 'vitest';

const cookiesMock = vi.fn();

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

function mockSessionCookie(token = 'session-token') {
  cookiesMock.mockResolvedValue({
    get: vi.fn((name) => {
      if (name === 'careeriz_session') return { value: token };
      return undefined;
    }),
  });
}

function mockNoSessionCookie() {
  cookiesMock.mockResolvedValue({ get: vi.fn(() => undefined) });
}

function jsonRequest(body) {
  return { json: async () => body, headers: new Headers() };
}

describe('billing route handlers - authenticated same-origin boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BACKEND_API_BASE_URL = 'http://127.0.0.1:5000/api';
    global.fetch = vi.fn();
  });

  test('PUT /api/billing/profile forwards the session token as a Bearer header and never exposes it in the response', async () => {
    mockSessionCookie('fictional-session-token');
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { legalCompanyName: 'Fictional Co' } }),
    });

    const { PUT } = await import('@/app/api/billing/profile/route');
    const response = await PUT(jsonRequest({ legalCompanyName: 'Fictional Co' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: { legalCompanyName: 'Fictional Co' } });
    expect(JSON.stringify(body)).not.toContain('fictional-session-token');

    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.Authorization).toBe('Bearer fictional-session-token');
  });

  test('POST /api/billing/purchases forwards the Idempotency-Key header to the backend', async () => {
    mockSessionCookie('fictional-session-token');
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { purchaseId: 'fictional-purchase' } }),
    });

    const { POST } = await import('@/app/api/billing/purchases/route');
    const request = {
      json: async () => ({ productCode: 'ATS_DB_1M' }),
      headers: new Headers({ 'idempotency-key': 'fictional-idempotency-key' }),
    };
    const response = await POST(request);
    expect(response.status).toBe(200);

    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers['Idempotency-Key']).toBe('fictional-idempotency-key');
  });

  test('POST /api/billing/purchases/verify returns 401 without a session and never calls the backend', async () => {
    mockNoSessionCookie();
    const { POST } = await import('@/app/api/billing/purchases/verify/route');
    const response = await POST(jsonRequest({ purchaseId: 'fictional-purchase' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Authentication required.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('POST /api/billing/subscription/cancel normalizes a backend error without leaking internals', async () => {
    mockSessionCookie('fictional-session-token');
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Organisation billing management permission required.', details: { code: 'PERMISSION_DENIED' } }),
    });

    const { POST } = await import('@/app/api/billing/subscription/cancel/route');
    const response = await POST(jsonRequest({ reason: 'fictional reason for cancelling' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      message: 'Organisation billing management permission required.',
      details: { code: 'PERMISSION_DENIED' },
    });
    // Never a raw stack trace or Error object shape.
    expect(body).not.toHaveProperty('stack');
    expect(typeof body.message).toBe('string');
  });
});
