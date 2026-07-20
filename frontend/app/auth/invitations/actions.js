'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { acceptOrganisationInvitation } from '@/lib/api';
import { ORGANISATION_COOKIE } from '@/lib/auth';

export async function acceptOrganisationInvitationAction(token) {
  const response = await acceptOrganisationInvitation(token);
  const cookieStore = await cookies();
  cookieStore.set(ORGANISATION_COOKIE, response.activeOrganisationId || response.membership?.organisationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect('/recruiter?notice=invitation-accepted');
}
