import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/auth';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectUrl = new URL('/auth', request.nextUrl.origin);

  if (!token) {
    redirectUrl.searchParams.set('oauthError', 'Invalid verification link.');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await requestBackend('/auth/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    redirectUrl.searchParams.set('authStatus', 'email-verified');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set('oauthError', error.message || 'Invalid verification link.');
    return NextResponse.redirect(redirectUrl);
  }
}
