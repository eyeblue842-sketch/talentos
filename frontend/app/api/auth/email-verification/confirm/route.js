import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/auth';
import { safeInternalPath } from '@/lib/roles';
import { resolveRequestOrigin } from '@/lib/request-origin';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = resolveRequestOrigin(request);
  const resultUrl = new URL('/auth/verify-email', origin);

  if (!token) {
    resultUrl.searchParams.set('status', 'error');
    return NextResponse.redirect(resultUrl);
  }

  try {
    const result = await requestBackend('/auth/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    // Sends the user back to where they started (e.g. an organisation
    // invitation) once verified - re-validated here even though registerUser/
    // confirmEmailVerification already validate it, since this is the
    // point a redirect Location header actually gets built.
    const next = safeInternalPath(result?.data?.next, null);
    if (next) {
      const redirectUrl = new URL(next, origin);
      redirectUrl.searchParams.set('authStatus', 'email-verified');
      return NextResponse.redirect(redirectUrl);
    }

    // Everyone else lands on a page that states plainly that the email is verified.
    resultUrl.searchParams.set('status', 'success');
    if (result?.data?.audience) resultUrl.searchParams.set('audience', result.data.audience);
    return NextResponse.redirect(resultUrl);
  } catch {
    // Never echo the raw token or backend detail into the URL.
    resultUrl.searchParams.set('status', 'error');
    return NextResponse.redirect(resultUrl);
  }
}
