import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminAudit } from '@/lib/api';

export default async function AdminAuditPage() {
  let result = { items: [], meta: null };
  let error = '';
  try {
    result = await getAdminAudit();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Audit center" title="Review tenant-scoped audit activity" description="Searchable audit history for organization administration, hiring workflows, notifications, and sensitive changes." breadcrumb={[{ label: 'Admin' }, { label: 'Audit' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      <Card>
        <div className="space-y-3 text-sm">
          {result.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4">
              <p className="font-semibold">{item.action}</p>
              <p className="mt-1 text-[var(--muted)]">{item.entityType} | {item.entityId || 'n/a'} | {item.actorUser?.email || 'system'} | {new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {!result.items.length ? <p className="text-[var(--muted)]">No audit records found for the current organization scope.</p> : null}
        </div>
      </Card>
    </WorkspaceShell>
  );
}
