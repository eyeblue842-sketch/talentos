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

  const oauthBaseUrl =
    process.env.OAUTH_PUBLIC_BASE_URL ||
    'http://127.0.0.1:5000';

  const backendUrl = new URL(
    '/api/auth/oauth/google/start',
    oauthBaseUrl
  );

  backendUrl.searchParams.set('role', 'CANDIDATE');
  backendUrl.searchParams.set('mode', mode);
  backendUrl.searchParams.set('next', next);

  return NextResponse.redirect(backendUrl);
}