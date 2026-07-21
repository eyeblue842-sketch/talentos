import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminUsers } from '@/lib/api';
import { bulkInviteAdminUsersAction, bulkUpdateAdminUsersAction, transferAdminOwnershipAction, updateAdminMembershipAction } from '../actions';

export default async function AdminUsersPage() {
  let data = { items: [], meta: null };
  let error = '';
  try {
    data = await getAdminUsers();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="User administration" title="Manage organization users and memberships" description="Update membership roles, account state, ownership, and invitations using the existing organization foundation." breadcrumb={[{ label: 'Admin' }, { label: 'Users' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Active memberships</h2>
          <div className="mt-5 space-y-3">
            {data.items.map((item) => (
              <div key={item.membership.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{item.user.email}</p>
                <p className="mt-1 text-[var(--muted)]">{item.membership.role} | {item.membership.status} | {item.user.accountStatus || 'ACTIVE'}</p>
                <form action={updateAdminMembershipAction} className="mt-3 grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="membershipId" value={item.membership.id} />
                  <select name="role" defaultValue={item.membership.role} className="rounded-2xl border border-[var(--line)] px-3 py-2">
                    {['OWNER','ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','VIEWER'].map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <select name="status" defaultValue={item.membership.status} className="rounded-2xl border border-[var(--line)] px-3 py-2">
                    {['ACTIVE','INACTIVE'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select name="accountStatus" defaultValue={item.user.accountStatus || 'ACTIVE'} className="rounded-2xl border border-[var(--line)] px-3 py-2">
                    {['ACTIVE','SUSPENDED','DEACTIVATED'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button type="submit" className="rounded-full border border-[var(--line)] px-4 py-2 font-semibold">Update</button>
                </form>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-6">
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Bulk invite</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">One per line: `email,ROLE`.</p>
            <form action={bulkInviteAdminUsersAction} className="mt-5 grid gap-3 text-sm">
              <textarea name="invitations" className="min-h-40 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder={`new@company.com,RECRUITER\nmanager@company.com,HIRING_MANAGER`} />
              <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Send invitations</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Bulk membership update</h2>
            <form action={bulkUpdateAdminUsersAction} className="mt-5 grid gap-3 text-sm">
              <input name="membershipIds" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Membership IDs, comma separated" />
              <select name="role" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
                <option value="">No role change</option>
                {['ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','VIEWER'].map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <select name="status" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
                <option value="">No membership status change</option>
                {['ACTIVE','INACTIVE'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select name="accountStatus" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
                <option value="">No account status change</option>
                {['ACTIVE','SUSPENDED','DEACTIVATED'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button type="submit" className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold">Apply bulk update</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Transfer ownership</h2>
            <form action={transferAdminOwnershipAction} className="mt-5 grid gap-3 text-sm">
              <input name="membershipId" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Target membership ID" />
              <button type="submit" className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold">Transfer organization ownership</button>
            </form>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}
