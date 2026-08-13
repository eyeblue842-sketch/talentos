import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  requestBackend,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';
import {
  resolvePostAuthRoute,
  safeInternalPath,
} from '@/lib/roles';

function getPublicOrigin(request) {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL;
  }

  const proto =
    request.headers.get('x-forwarded-proto') || 'http';

  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host');

  return `${proto}://${host}`;
}

export async function GET(request) {
  const publicOrigin = getPublicOrigin(request);

  const code = request.nextUrl.searchParams.get('code');
  const next = safeInternalPath(
    request.nextUrl.searchParams.get('next'),
    '/auth'
  );

  if (!code) {
    const redirectUrl = new URL('/auth', publicOrigin);
    redirectUrl.searchParams.set(
      'oauthError',
      'Invalid OAuth callback.'
    );

    return NextResponse.redirect(redirectUrl);
  }

  try {
    const response = await requestBackend('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ token: code }),
    });

    const cookieStore = await cookies();

    cookieStore.set(
      SESSION_COOKIE,
      response.data.token,
      sessionCookieOptions()
    );

    const target = resolvePostAuthRoute(
      response.data.session.user.role,
      next
    );

    return NextResponse.redirect(
      new URL(target, publicOrigin)
    );
  } catch (error) {
    const redirectUrl = new URL('/auth', publicOrigin);

    redirectUrl.searchParams.set(
      'oauthError',
      error.message || 'OAuth sign-in failed.'
    );

    return NextResponse.redirect(redirectUrl);
  }
}
