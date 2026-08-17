import { NextResponse } from 'next/server';
import { requireApiSession, mapApiRouteError, proxyBackendJson } from '@/lib/api-route';
import { getCurrentOrganisation } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { resumeSearchV2RequestSchema } from '@careeriz/shared';
import { isResumeSearchV2RolloutEnabledForServer } from '@/lib/resume-search-v2-rollout.server';

const MAX_BODY_BYTES = 32 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

function jsonHeaders() {
  return {
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

function safeErrorResponse(message, status, code, details) {
  return NextResponse.json(
    { success: false, message, code, ...(details ? { details } : {}) },
    { status, headers: jsonHeaders() },
  );
}

export async function POST(request) {
  const session = await requireApiSession();
  if (!session.ok) {
    return NextResponse.json(await session.response.json(), { status: session.response.status, headers: jsonHeaders() });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return safeErrorResponse('JSON content type is required.', 415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    const bodyText = await request.text();
    if (!bodyText.trim()) {
      return safeErrorResponse('JSON body is required.', 400, 'INVALID_JSON');
    }

    if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
      return safeErrorResponse('Search request is too large.', 413, 'PAYLOAD_TOO_LARGE');
    }

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return safeErrorResponse('Malformed JSON body.', 400, 'INVALID_JSON');
    }

    const parsed = resumeSearchV2RequestSchema.safeParse(body);
    if (!parsed.success) {
      return safeErrorResponse('The recruiter search request is invalid.', 422, 'INVALID_SEARCH_REQUEST');
    }

    const [currentUser, organisation] = await Promise.all([
      getCurrentUser(),
      getCurrentOrganisation(),
    ]);

    if (!isResumeSearchV2RolloutEnabledForServer({ user: currentUser, organisation })) {
      return safeErrorResponse('Resume Search V2 is not available in this workspace.', 404, 'RESUME_SEARCH_V2_NOT_AVAILABLE');
    }

    const response = await proxyBackendJson('/resumes/search/v2', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }, session.token);

    return NextResponse.json(response, { headers: jsonHeaders() });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return safeErrorResponse('Resume Search V2 is temporarily unavailable.', 503, 'UPSTREAM_TIMEOUT');
    }

    const status = error?.statusCode || error?.status || 500;
    if (status === 401) return safeErrorResponse('Authentication required.', 401, 'AUTH_REQUIRED');
    if (status === 403) return safeErrorResponse('You do not have access to Resume Search V2.', 403, 'ACCESS_DENIED');
    if (status === 404) return safeErrorResponse('Resume Search V2 is unavailable.', 404, error?.code || 'RESUME_SEARCH_V2_UNAVAILABLE');
    if (status === 422 || status === 400) return safeErrorResponse('The recruiter search request is invalid.', 422, error?.code || 'INVALID_SEARCH_REQUEST');
    if (status >= 500) return safeErrorResponse('Resume Search V2 is temporarily unavailable.', 503, 'UPSTREAM_UNAVAILABLE');
    return mapApiRouteError(error);
  }
}
