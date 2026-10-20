import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ORGANISATION_COOKIE, requestBackend, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

// Creates the invited recruiter's account from the invitation link, joins them
// to the inviting organisation and signs them in (same cookies as /api/auth/login).
export async function POST(request) {
  try {
    const payload = await request.json();
    const response = await requestBackend('/organisations/invitations/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, response.data.token, sessionCookieOptions());

    const session = response.data.session;
    const activeOrganisationId = session?.activeMembership?.organisationId
      || session?.memberships?.find((membership) => membership.status === 'ACTIVE')?.organisationId
      || null;
    if (activeOrganisationId) {
      cookieStore.set(ORGANISATION_COOKIE, activeOrganisationId, sessionCookieOptions());
    } else {
      cookieStore.delete(ORGANISATION_COOKIE);
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message, details: error.details },
      { status: error.statusCode || 500 }
    );
  }
}
