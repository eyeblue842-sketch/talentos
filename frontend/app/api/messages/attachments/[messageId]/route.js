import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, getSessionToken, ORGANISATION_COOKIE } from '@/lib/auth';

export async function GET(request, { params }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const organisationId = cookieStore.get(ORGANISATION_COOKIE)?.value || null;
  const { messageId } = await params;
  const response = await fetch(`${getBackendApiBaseUrl()}/messages/attachments/${messageId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(organisationId ? { 'x-organisation-id': organisationId } : {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ success: false, message: 'Unable to download attachment.' }));
    return NextResponse.json(payload, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': response.headers.get('content-disposition') || 'attachment',
    },
  });
}
