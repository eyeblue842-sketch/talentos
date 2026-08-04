import { NextResponse } from 'next/server';
import { safeInternalPath } from '@/lib/roles';

export async function GET(request) {
  const mode =
    request.nextUrl.searchParams.get('mode') === 'signup'
      ? 'signup'
      : 'login';

  const next = safeInternalPath(
    request.nextUrl.searchParams.get('next'),
    '/candidate/dashboard'
  );

  const forwardedProto =
    request.headers.get('x-forwarded-proto') || 'https';

  const forwardedHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'careeriz.com';

  const publicOrigin = `${forwardedProto}://${forwardedHost}`;

  const backendUrl = new URL(
    '/api/auth/oauth/google/start',
    publicOrigin
  );

  backendUrl.searchParams.set('role', 'CANDIDATE');
  backendUrl.searchParams.set('mode', mode);
  backendUrl.searchParams.set('next', next);

  return NextResponse.redirect(backendUrl);
}
