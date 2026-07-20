import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { acceptOrganisationInvitationAction } from '../actions';
import { getInvitationTokenDetail } from '@/lib/api';
import { buildPathWithParams, employerAuthRoutes } from '@/lib/auth-experience';
import { getCurrentUser } from '@/lib/auth';

export default async function InvitationAcceptPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === 'string' ? params.token : '';
  const user = await getCurrentUser();

  if (!token) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <Alert tone="danger" title="Invitation missing">
          A valid invitation token is required.
        </Alert>
      </main>
    );
  }

  let invitation = null;
  let error = '';
  try {
    invitation = await getInvitationTokenDetail(token);
  } catch (caught) {
    error = caught.message;
  }

  if (user && user.role !== 'RECRUITER') {
    redirect('/candidate/dashboard');
  }

  const loginHref = buildPathWithParams(employerAuthRoutes.login, { next: `/auth/invitations/accept?token=${encodeURIComponent(token)}` });
  const registerHref = buildPathWithParams(employerAuthRoutes.register, { next: `/auth/invitations/accept?token=${encodeURIComponent(token)}` });

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">Careeriz Hire Invitation</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text)]">Join your recruiter workspace.</h1>

        {error ? (
          <Alert tone="danger" className="mt-6" title="Invitation unavailable">
            {error}
          </Alert>
        ) : null}

        {invitation ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-5">
              <p className="font-semibold text-[var(--color-text)]">{invitation.organisation?.name}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Role: {invitation.role}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Expires: {new Date(invitation.expiresAt).toLocaleString()}</p>
            </div>

            {!user ? (
              <div className="flex flex-wrap gap-3">
                <Button as={Link} href={loginHref}>Employer Sign In</Button>
                <Button as={Link} href={registerHref} variant="outline">Create Employer Account</Button>
              </div>
            ) : (
              <form action={acceptOrganisationInvitationAction.bind(null, token)} className="flex flex-wrap gap-3">
                <Button type="submit">Accept Invitation</Button>
                <Button as={Link} href="/recruiter" variant="outline">Back to Recruiter Workspace</Button>
              </form>
            )}
          </div>
        ) : null}
      </Card>
    </main>
  );
}
