import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { safeInternalPath } from '@/lib/roles';

function buildErrorRedirect(request, message) {
  const redirectUrl = new URL('/auth/candidate/login', request.nextUrl.origin);
  redirectUrl.searchParams.set('oauthError', message);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request) {
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (error) {
    return buildErrorRedirect(request, errorDescription || 'Google sign-in was cancelled.');
  }

  if (!code || !state) {
    return buildErrorRedirect(request, 'Invalid Google OAuth callback.');
  }

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', code, state }),
      cache: 'no-store',
    });

    const payload = await response.json();
    if (!response.ok) {
      return buildErrorRedirect(request, payload?.message || 'Google sign-in failed.');
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, payload.data.token, sessionCookieOptions());

    const target = safeInternalPath(payload.data.nextPath, '/candidate/dashboard');
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  } catch {
    return buildErrorRedirect(request, 'Google sign-in failed.');
  }
}
