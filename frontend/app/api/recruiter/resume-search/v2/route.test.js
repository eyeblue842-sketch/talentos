import { beforeEach, describe, expect, test, vi } from 'vitest';

const requireApiSession = vi.fn();
const proxyBackendJson = vi.fn();
const getCurrentUser = vi.fn();
const getCurrentOrganisation = vi.fn();
const rolloutCheck = vi.fn();

vi.mock('@/lib/api-route', () => ({
  requireApiSession,
  proxyBackendJson,
  mapApiRouteError: vi.fn((error) => Response.json({ success: false, message: error?.message || 'Request failed.' }, { status: error?.statusCode || 500 })),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser,
}));

vi.mock('@/lib/api', () => ({
  getCurrentOrganisation,
}));

vi.mock('@/lib/resume-search-v2-rollout.server', () => ({
  isResumeSearchV2RolloutEnabledForServer: rolloutCheck,
}));

async function loadRoute() {
  return import('@/app/api/recruiter/resume-search/v2/route');
}

function buildRequest({ body, headers } = {}) {
  return new Request('http://localhost:3000/api/recruiter/resume-search/v2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: body == null ? JSON.stringify({
      keywords: [{ term: 'IT', mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 25,
      cursor: null,
    }) : body,
  });
}

describe('resume search v2 proxy route', () => {
  beforeEach(() => {
    vi.resetModules();
    requireApiSession.mockReset();
    proxyBackendJson.mockReset();
    getCurrentUser.mockReset();
    getCurrentOrganisation.mockReset();
    rolloutCheck.mockReset();

    requireApiSession.mockResolvedValue({ ok: true, token: 'session-token' });
    getCurrentUser.mockResolvedValue({ id: 'user-1', role: 'RECRUITER' });
    getCurrentOrganisation.mockResolvedValue({ id: 'org-1' });
    rolloutCheck.mockReturnValue(true);
  });

  test('rejects unauthenticated access', async () => {
    requireApiSession.mockResolvedValue({
      ok: false,
      response: Response.json({ success: false, message: 'Authentication required.' }, { status: 401 }),
    });
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(401);
  });

  test('exports only POST for the proxy handler', async () => {
    const routeModule = await loadRoute();
    expect(typeof routeModule.POST).toBe('function');
    expect(routeModule.GET).toBeUndefined();
  });

  test('rejects invalid content type', async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest({ headers: { 'content-type': 'text/plain' }, body: 'not-json' }));
    expect(response.status).toBe(415);
    expect((await response.json()).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('rejects malformed json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest({ body: '{bad json' }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_JSON');
  });

  test('rejects oversized payloads', async () => {
    const { POST } = await loadRoute();
    const huge = JSON.stringify({
      keywords: [{ term: 'x'.repeat(33000), mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 25,
      cursor: null,
    });
    const response = await POST(buildRequest({ body: huge }));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('denies direct proxy access when rollout is disabled for the authenticated workspace', async () => {
    rolloutCheck.mockReturnValue(false);
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('RESUME_SEARCH_V2_NOT_AVAILABLE');
  });

  test('does not trust a tampered organisation id in the payload', async () => {
    proxyBackendJson.mockResolvedValue({ success: true, data: { items: [], meta: { pageSize: 25, nextCursor: null, totalRelation: 'EQ', totalValue: 0, searchEngine: 'OPENSEARCH', indexSchemaVersion: '2', queryFingerprint: 'fp-1' } } });
    const { POST } = await loadRoute();
    await POST(buildRequest({ body: JSON.stringify({
      keywords: [{ term: 'IT', mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 25,
      cursor: null,
      organisationId: 'org-tampered',
    }) }));
    expect(proxyBackendJson).toHaveBeenCalledWith('/resumes/search/v2', expect.objectContaining({
      body: expect.not.stringContaining('org-tampered'),
    }), 'session-token');
  });

  test('maps backend 401 and 403 safely', async () => {
    const { POST } = await loadRoute();

    proxyBackendJson.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 401 }));
    let response = await POST(buildRequest());
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('AUTH_REQUIRED');

    proxyBackendJson.mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: 403 }));
    response = await POST(buildRequest());
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ACCESS_DENIED');
  });

  test('maps backend validation errors safely', async () => {
    proxyBackendJson.mockRejectedValueOnce(Object.assign(new Error('invalid'), { statusCode: 422 }));
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('INVALID_SEARCH_REQUEST');
  });

  test('maps backend timeouts safely', async () => {
    proxyBackendJson.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('UPSTREAM_TIMEOUT');
  });

  test('returns no-cache headers and hides internal upstream errors', async () => {
    proxyBackendJson.mockRejectedValueOnce(Object.assign(new Error('OpenSearch index crash'), { statusCode: 500 }));
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.message).toBe('Resume Search V2 is temporarily unavailable.');
    expect(body.message).not.toContain('OpenSearch');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  test('proxies an authorized request successfully', async () => {
    proxyBackendJson.mockResolvedValue({
      success: true,
      data: {
        items: [],
        meta: {
          pageSize: 25,
          nextCursor: null,
          totalRelation: 'EQ',
          totalValue: 0,
          searchEngine: 'OPENSEARCH',
          indexSchemaVersion: '2',
          queryFingerprint: 'fp-1',
        },
      },
    });
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  test('allows an authorized platform administrator without trusting caller-controlled organisation fields', async () => {
    getCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    getCurrentOrganisation.mockResolvedValue({ id: 'org-denied' });
    rolloutCheck.mockImplementation(({ user }) => user?.role === 'ADMIN');
    proxyBackendJson.mockResolvedValue({
      success: true,
      data: {
        items: [],
        meta: {
          pageSize: 25,
          nextCursor: null,
          totalRelation: 'EQ',
          totalValue: 0,
          searchEngine: 'OPENSEARCH',
          indexSchemaVersion: '2',
          queryFingerprint: 'fp-1',
        },
      },
    });

    const { POST } = await loadRoute();
    const response = await POST(buildRequest({ body: JSON.stringify({
      keywords: [{ term: 'IT', mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 25,
      cursor: null,
      organisationId: 'org-tampered',
    }) }));

    expect(response.status).toBe(200);
    expect(rolloutCheck).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: 'ADMIN' }),
      organisation: expect.objectContaining({ id: 'org-denied' }),
    }));
    expect(proxyBackendJson).toHaveBeenCalledWith('/resumes/search/v2', expect.objectContaining({
      body: expect.not.stringContaining('org-tampered'),
    }), 'session-token');
  });
});
