import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl } from '@/lib/auth';
import { safeInternalPath } from '@/lib/roles';

export async function GET(request) {
  const mode = request.nextUrl.searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const next = safeInternalPath(request.nextUrl.searchParams.get('next'), '/candidate/dashboard');
  const backendUrl = new URL(`${getBackendApiBaseUrl()}/auth/oauth/google/start`);

  backendUrl.searchParams.set('role', 'CANDIDATE');
  backendUrl.searchParams.set('mode', mode);
  backendUrl.searchParams.set('next', next);

  return NextResponse.redirect(backendUrl);
}
