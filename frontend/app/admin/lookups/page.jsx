import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminLookups } from '@/lib/api';
import { updateAdminLookupsAction } from '../actions';

export default async function AdminLookupsPage() {
  let lookups = null;
  let error = '';
  try {
    lookups = await getAdminLookups();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="System configuration" title="Manage organization lookup values" description="Maintain organization-scoped lookup catalogs for skills, locations, departments, workflow statuses, and related platform lists." breadcrumb={[{ label: 'Admin' }, { label: 'Lookups' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {lookups ? (
        <Card>
          <form action={updateAdminLookupsAction} className="grid gap-3 text-sm">
            {['skills','locations','departments','employmentTypes','currencies','countries','interviewTypes','offerStatuses','workflowStatuses'].map((field) => (
              <input
                key={field}
                name={field}
                defaultValue={(lookups[field] || []).join(', ')}
                className="rounded-2xl border border-[var(--line)] px-4 py-3"
                placeholder={`${field}, comma separated`}
              />
            ))}
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save lookup configuration</button>
          </form>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}
