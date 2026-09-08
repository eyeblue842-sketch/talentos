import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/auth';
import { safeInternalPath } from '@/lib/roles';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const fallbackUrl = new URL('/auth', request.nextUrl.origin);

  if (!token) {
    fallbackUrl.searchParams.set('oauthError', 'Invalid verification link.');
    return NextResponse.redirect(fallbackUrl);
  }

  try {
    const result = await requestBackend('/auth/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    // Sends the user back to where they started (e.g. an organisation
    // invitation) once verified, instead of always landing on the generic
    // /auth page - re-validated here even though registerUser/
    // confirmEmailVerification already validate it, since this is the
    // point a redirect Location header actually gets built.
    const next = safeInternalPath(result?.data?.next, null);
    const redirectUrl = next ? new URL(next, request.nextUrl.origin) : fallbackUrl;
    redirectUrl.searchParams.set('authStatus', 'email-verified');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    fallbackUrl.searchParams.set('oauthError', error.message || 'Invalid verification link.');
    return NextResponse.redirect(fallbackUrl);
  }
}
