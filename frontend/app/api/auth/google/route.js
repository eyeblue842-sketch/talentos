import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl } from '@/lib/auth';
import { safeInternalPath } from '@/lib/roles';

const ALLOWED_ROLES = new Set(['CANDIDATE', 'RECRUITER']);
const ALLOWED_EMPLOYER_TYPES = new Set(['CONSULTANCY', 'COMPANY']);

export async function GET(request) {
  const mode =
    request.nextUrl.searchParams.get('mode') === 'signup'
      ? 'signup'
      : 'login';

  const requestedRole = (request.nextUrl.searchParams.get('role') || '').toUpperCase();
  const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : 'CANDIDATE';

  const requestedEmployerType = (request.nextUrl.searchParams.get('employerType') || '').toUpperCase();
  const employerType = ALLOWED_EMPLOYER_TYPES.has(requestedEmployerType) ? requestedEmployerType : 'CONSULTANCY';

  const next = safeInternalPath(
    request.nextUrl.searchParams.get('next'),
    role === 'RECRUITER' ? '/recruiter/home' : '/candidate/dashboard'
  );

  const headers = request?.headers;
  const requestOrigin = request?.nextUrl?.origin || 'https://careeriz.com';
  const forwardedProto =
    headers?.get?.('x-forwarded-proto') ||
    new URL(requestOrigin).protocol.replace(':', '');
  const forwardedHost =
    headers?.get?.('x-forwarded-host') ||
    headers?.get?.('host') ||
    new URL(requestOrigin).host;

  const backendApiBaseUrl = getBackendApiBaseUrl() || process.env.OAUTH_PUBLIC_BASE_URL;
  const backendUrl = backendApiBaseUrl
    ? new URL('auth/oauth/google/start', `${backendApiBaseUrl.replace(/\/+$/, '')}/`)
    : new URL('/api/auth/oauth/google/start', `${forwardedProto}://${forwardedHost}`);

  backendUrl.searchParams.set('role', role);
  if (role === 'RECRUITER') {
    backendUrl.searchParams.set('employerType', employerType);
  }
  backendUrl.searchParams.set('mode', mode);
  backendUrl.searchParams.set('next', next);

  return NextResponse.redirect(backendUrl);
}
