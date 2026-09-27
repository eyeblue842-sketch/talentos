import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ORGANISATION_COOKIE, requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  try {
    if (token) {
      await requestBackend('/auth/logout', { method: 'POST' }, token);
    }
  } catch (error) {
    if (error.statusCode !== 401) {
      return NextResponse.json(
        { success: false, message: 'Logout could not be completed safely.' },
        { status: error.statusCode || 502 }
      );
    }
  }

  cookieStore.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  // Clear org context so it can never leak into the next account's session.
  cookieStore.delete(ORGANISATION_COOKIE);

  return NextResponse.json({ success: true, data: { loggedOut: true } });
}
