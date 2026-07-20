import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { resolvePostAuthRoute, safeInternalPath } from '@/lib/roles';

export async function GET(request) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeInternalPath(request.nextUrl.searchParams.get('next'), '/auth');

  if (!code) {
    const redirectUrl = new URL('/auth', request.nextUrl.origin);
    redirectUrl.searchParams.set('oauthError', 'Invalid OAuth callback.');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const response = await requestBackend('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ token: code }),
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, response.data.token, sessionCookieOptions());
    const target = resolvePostAuthRoute(response.data.session.user.role, next);
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  } catch (error) {
    const redirectUrl = new URL('/auth', request.nextUrl.origin);
    redirectUrl.searchParams.set('oauthError', error.message || 'OAuth sign-in failed.');
    return NextResponse.redirect(redirectUrl);
  }
}
