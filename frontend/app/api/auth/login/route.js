import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ORGANISATION_COOKIE, requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  try {
    const payload = await request.json();
    const response = await requestBackend('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, response.data.token, sessionCookieOptions());

    // Reset the organisation context to THIS user's own org on every login.
    // Without this, a stale careeriz_org cookie from a previously logged-in
    // account leaks into the new session as x-organisation-id; the backend
    // then resolves activeMembership to null (the new user is not a member of
    // that stale org), which silently hides org-scoped controls such as the
    // company profile / About / blog editing for a legitimate org owner.
    const session = response.data.session;
    const activeOrganisationId = session?.activeMembership?.organisationId
      || session?.memberships?.find((membership) => membership.status === 'ACTIVE')?.organisationId
      || null;
    if (activeOrganisationId) {
      cookieStore.set(ORGANISATION_COOKIE, activeOrganisationId, sessionCookieOptions());
    } else {
      cookieStore.delete(ORGANISATION_COOKIE);
    }

    return NextResponse.json({ success: true, data: response.data.session });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
