import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }

    const response = await requestBackend('/messages/unread-count', { method: 'GET' }, token);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: error.statusCode || 500 });
  }
}
