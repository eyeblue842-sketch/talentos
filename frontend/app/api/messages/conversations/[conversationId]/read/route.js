import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { conversationId } = await params;
    const payload = await request.json().catch(() => ({}));
    const response = await requestBackend(`/messages/conversations/${conversationId}/read`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}
