import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, RESET_SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectUrl = new URL('/auth', request.nextUrl.origin);

  if (!token) {
    redirectUrl.searchParams.set('resetError', '1');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const response = await requestBackend('/auth/password-reset/session', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    const cookieStore = await cookies();
    cookieStore.set(RESET_SESSION_COOKIE, response.data.token, sessionCookieOptions(10 * 60));
    redirectUrl.searchParams.set('authStatus', 'password-reset-ready');
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set('resetError', '1');
    return NextResponse.redirect(redirectUrl);
  }
}
