import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, getSessionToken, ORGANISATION_COOKIE, requestBackend } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { conversationId } = await params;
    const { search } = new URL(request.url);
    const response = await requestBackend(`/messages/conversations/${conversationId}/messages${search}`, { method: 'GET' }, token);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}

export async function POST(request, { params }) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const organisationId = cookieStore.get(ORGANISATION_COOKIE)?.value || null;
  const { conversationId } = await params;
  const formData = await request.formData();
  const response = await fetch(`${getBackendApiBaseUrl()}/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(organisationId ? { 'x-organisation-id': organisationId } : {}),
    },
    body: formData,
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
