import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, RESET_SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  const cookieStore = await cookies();
  const resetSessionToken = cookieStore.get(RESET_SESSION_COOKIE)?.value;

  if (!resetSessionToken) {
    return NextResponse.json(
      { success: false, message: 'Password reset session is missing or expired.' },
      { status: 400 }
    );
  }

  try {
    const payload = await request.json();
    const response = await requestBackend('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: resetSessionToken,
        password: payload.password,
      }),
    });
    cookieStore.set(RESET_SESSION_COOKIE, '', sessionCookieOptions(0));
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
