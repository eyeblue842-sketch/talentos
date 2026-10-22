import { getBackendApiBaseUrl, getSessionToken } from '@/lib/auth';

// Profile photo of a person the signed-in user is allowed to view (checked by the backend).
export async function GET(_request, { params }) {
  const token = await getSessionToken();
  if (!token) {
    return new Response('Authentication required.', { status: 401 });
  }

  const { userId } = await params;
  const response = await fetch(`${getBackendApiBaseUrl()}/network/people/${encodeURIComponent(userId)}/photo`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  // No photo is a normal state: answer 204 so the avatar fallback shows without console errors.
  if (response.status === 404) {
    return new Response(null, { status: 204, headers: { 'cache-control': 'private, max-age=60' } });
  }

  if (!response.ok || !response.body) {
    return new Response('Profile photo not found.', { status: response.status || 404 });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/octet-stream',
      'cache-control': response.headers.get('cache-control') || 'private, max-age=60',
      ...(response.headers.get('content-length') ? { 'content-length': response.headers.get('content-length') } : {}),
    },
  });
}
