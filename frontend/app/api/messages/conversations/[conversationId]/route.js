import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const { conversationId } = await params;
    const response = await requestBackend(`/messages/conversations/${conversationId}`, { method: 'GET' }, token);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}
