import { getBackendApiBaseUrl, getSessionToken } from '@/lib/auth';

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return new Response('Authentication required.', { status: 401 });
  }

  const response = await fetch(`${getBackendApiBaseUrl()}/candidate/profile-photo`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  // No photo uploaded yet is a normal state, not an error: answer 204 so the browser
  // console (and monitoring) is not flooded with a 404 on every page load. The <img>
  // onError fallback still shows the default avatar.
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
