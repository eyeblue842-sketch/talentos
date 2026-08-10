import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionToken, requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const response = await requestBackend(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword,
        }),
      },
      token
    );

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, response.data.token, sessionCookieOptions());

    return NextResponse.json({ success: true, data: response.data.session });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
