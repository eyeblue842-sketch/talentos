import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { inviteOrganisationMemberAction, resendOrganisationInvitationAction, revokeOrganisationInvitationAction } from '../actions';
import { getCurrentUser } from '@/lib/auth';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getOrganisationInvitations, getOrganisationMembers } from '@/lib/api';

const manageableRoles = ['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not available';
}

export default async function RecruiterMembersPage({ searchParams }) {
  let organisation = null;
  let members = [];
  let invitations = [];
  let error = '';
  const params = await searchParams;
  const currentUser = await getCurrentUser();

  try {
    [organisation, members, invitations] = await Promise.all([
      getCurrentOrganisation(),
      getOrganisationMembers(),
      getOrganisationInvitations(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const currentUserCanManage = ['OWNER', 'ADMIN'].includes(currentUser?.activeMembership?.role || '');

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Organisation members"
        description="Manage active team membership and secure invitation-based workspace access."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Members' }]}
      />

      {params?.notice === 'invitation-sent' ? (
        <Alert tone="success" title="Invitation sent">
          The teammate invitation was created successfully.
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Members unavailable">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Active members</h2>
            <div className="mt-5 space-y-3">
              {members.length === 0 ? <p className="text-sm text-[var(--muted)]">No members found for this organisation.</p> : null}
              {members.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] p-4 text-sm">
                  <div>
                    <p className="font-semibold">{member.user?.email}</p>
                    <p className="text-[var(--muted)]">Joined {formatDate(member.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="brand">{member.role}</Badge>
                    <Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Pending invitations</h2>
            <div className="mt-5 space-y-3">
              {invitations.length === 0 ? <p className="text-sm text-[var(--muted)]">No pending or historical invitations yet.</p> : null}
              {invitations.map((invitation) => (
                <div key={invitation.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{invitation.email}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Sent {formatDate(invitation.createdAt)} • Expires {formatDate(invitation.expiresAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="brand">{invitation.role}</Badge>
                      <Badge tone={invitation.status === 'PENDING' ? 'warning' : invitation.status === 'ACCEPTED' ? 'success' : 'neutral'}>{invitation.status}</Badge>
                    </div>
                  </div>
                  {currentUserCanManage && invitation.status === 'PENDING' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={resendOrganisationInvitationAction.bind(null, invitation.id)}>
                        <Button type="submit" variant="outline" size="sm">Resend</Button>
                      </form>
                      <form action={revokeOrganisationInvitationAction.bind(null, invitation.id)}>
                        <Button type="submit" variant="danger" size="sm">Revoke</Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Invite teammate</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Only organisation owners and admins can create or manage invitations.</p>
          {currentUserCanManage ? (
            <form action={inviteOrganisationMemberAction} className="mt-5 grid gap-3">
              <input name="email" type="email" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="teammate@company.com" required />
              <select name="role" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="RECRUITER">
                {manageableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <Button type="submit">Send invitation</Button>
            </form>
          ) : (
            <Alert tone="info" className="mt-5" title="Access limited">
              Your current workspace role does not allow member management.
            </Alert>
          )}
        </Card>
      </div>
    </WorkspaceShell>
  );
}
