import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminRoles } from '@/lib/api';
import { saveAdminRoleAction } from '../actions';

export default async function AdminRolesPage() {
  let roles = [];
  let error = '';
  try {
    roles = await getAdminRoles();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Role and permission system" title="Manage system and custom organization roles" description="Use centralized permission definitions instead of scattering new hardcoded access checks." breadcrumb={[{ label: 'Admin' }, { label: 'Roles' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Current role definitions</h2>
          <div className="mt-5 space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{role.name}</p>
                <p className="mt-1 text-[var(--muted)]">{role.slug} | {role.isSystem ? 'System role' : 'Custom role'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(role.permissions || []).map((permission) => <span key={permission} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">{permission}</span>)}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Create or update role</h2>
          <form action={saveAdminRoleAction} className="mt-5 grid gap-3 text-sm">
            <input name="id" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Existing role ID to update (optional)" />
            <input name="name" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Role name" />
            <input name="slug" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="role-slug" />
            <select name="baseRole" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
              <option value="">No inherited base role</option>
              {['OWNER','ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','VIEWER'].map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <textarea name="description" className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Description" />
            <textarea name="permissions" className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Comma separated permissions" />
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save role definition</button>
          </form>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
