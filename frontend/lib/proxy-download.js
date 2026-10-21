import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, getSessionToken, ORGANISATION_COOKIE } from '@/lib/auth';

// Streams a file from the backend to the browser using the caller's session
// (the browser only holds an httpOnly cookie; the backend expects a Bearer token).
export async function proxyBackendDownload(backendPath, { search = '' } = {}) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const organisationId = cookieStore.get(ORGANISATION_COOKIE)?.value || null;
  const response = await fetch(`${getBackendApiBaseUrl()}${backendPath}${search}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(organisationId ? { 'x-organisation-id': organisationId } : {}),
    },
    cache: 'no-store',
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({ success: false, message: 'Unable to download the file.' }));
    return NextResponse.json(payload, { status: response.status || 404 });
  }

  const headers = {
    'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'private, no-store',
  };
  const disposition = response.headers.get('content-disposition');
  if (disposition) headers['Content-Disposition'] = disposition;
  const length = response.headers.get('content-length');
  if (length) headers['Content-Length'] = length;
  return new NextResponse(response.body, { status: 200, headers });
}
