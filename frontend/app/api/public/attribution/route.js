import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

// Same-origin relay for the LinkedIn attribution beacon. Attaches the session
// (when there is one) so the backend can verify outcome events for the signed-in
// user; anonymous visitors simply send click / registration-start events.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = await getSessionToken();
    const response = await requestBackend('/public/attribution', { method: 'POST', body: JSON.stringify(body) }, token || undefined);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    // Outcome events from signed-out visitors (401) and unknown refs are expected; never surface noise.
    return NextResponse.json({ success: false }, { status: error?.statusCode === 401 ? 202 : error?.statusCode || 400 });
  }
}
