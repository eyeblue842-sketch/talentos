import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

// Forwards a multipart logo upload to the backend with the caller's session +
// active-organisation cookie (requestBackend attaches both, and detects the
// FormData body as multipart so it doesn't force a JSON content-type).
export async function POST(request) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated.' }, { status: 401 });
    }
    const incoming = await request.formData();
    const file = incoming.get('logo');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, message: 'No logo file provided.' }, { status: 422 });
    }
    const forward = new FormData();
    forward.append('logo', file, file.name || 'logo');
    const response = await requestBackend('/organisations/current/logo', { method: 'POST', body: forward }, token);
    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 },
    );
  }
}
