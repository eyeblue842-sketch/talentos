import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestBackend, RESET_SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

// The reset-password page reads the reset-session cookie server-side, so
// the redirect target's origin must exactly match the host the browser used
// to reach this route (the cookie is scoped to that host) - request.nextUrl.origin
// can canonicalize to a different hostname (e.g. "localhost" even when the
// client actually requested "127.0.0.1"), which would silently strand the
// cookie on an origin the browser never navigates back to. Building the
// origin from the literal incoming Host header avoids that mismatch.
function resolveRequestOrigin(request) {
  const host = request.headers.get('host') || request.nextUrl.host;
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectUrl = new URL('/auth/reset-password', resolveRequestOrigin(request));

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
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set('resetError', '1');
    return NextResponse.redirect(redirectUrl);
  }
}
