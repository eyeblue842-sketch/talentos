import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend } from '@/lib/auth';

// The backend exposes the notifications list (GET /notifications) but no explicit
// unread counter, so we count unread (readAt == null) here for the header bell.
export async function GET() {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }
    const response = await requestBackend('/notifications', { method: 'GET' }, token);
    const items = Array.isArray(response?.data) ? response.data : [];
    const count = items.filter((item) => item && !item.readAt).length;
    return NextResponse.json({ success: true, data: { count } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode || 500 });
  }
}
