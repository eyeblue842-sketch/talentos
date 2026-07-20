import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getHomeRouteForRole } from '@/lib/roles';

export const SESSION_COOKIE = 'careeriz_session';
export const RESET_SESSION_COOKIE = 'careeriz_reset_session';
export const ORGANISATION_COOKIE = 'careeriz_org';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export function sessionCookieOptions(maxAge = 60 * 60 * 12) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

async function parseJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json();
}

export async function requestBackend(path, options = {}, token) {
  const cookieStore = await cookies();
  const activeOrganisationId = cookieStore.get(ORGANISATION_COOKIE)?.value || null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeOrganisationId ? { 'x-organisation-id': activeOrganisationId } : {}),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const body = await parseJson(response);
  if (!response.ok) {
    const error = new Error(body?.message || `Request failed for ${path}`);
    error.statusCode = response.status;
    error.details = body?.details;
    throw error;
  }

  return body;
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}

export async function getResetSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(RESET_SESSION_COOKIE)?.value || null;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const response = await requestBackend('/auth/me', { method: 'GET' }, token);
    return response.data;
  } catch {
    return null;
  }
}

export async function requireUser(role) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth');
  }

  const requiredRoles = Array.isArray(role) ? role : role ? [role] : [];
  if (requiredRoles.length && !requiredRoles.includes(user.role)) {
    redirect(getHomeRouteForRole(user.role));
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();
  if (!user) return null;

  redirect(getHomeRouteForRole(user.role));
}
