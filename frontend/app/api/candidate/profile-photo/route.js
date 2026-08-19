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
