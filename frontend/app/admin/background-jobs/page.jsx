import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminBackgroundJobs } from '@/lib/api';

export default async function AdminBackgroundJobsPage() {
  let data = null;
  let error = '';
  try {
    data = await getAdminBackgroundJobs();
  } catch (caught) {
    error = caught.message;
  }

  const rows = data ? [
    ['Resume parsing', data.resumeParsing.active, data.resumeParsing.note],
    ['Offer expiry', data.offerExpiry.active, data.offerExpiry.note],
    ['Interview reminders', data.interviewReminders.activeWindow, data.interviewReminders.note],
    ['Email queue proxy', data.emailQueue.visibleBacklogProxy, data.emailQueue.note],
    ['Failed jobs', data.failedJobs.active, data.failedJobs.note],
  ] : [];

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Background job dashboard" title="Monitor worker processing and queue health" description="This view surfaces persisted task activity, retries, and queue-adjacent operational signals for the production worker runtime." breadcrumb={[{ label: 'Admin' }, { label: 'Background Jobs' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {data ? (
        <Card>
          <div className="space-y-3 text-sm">
            {rows.map(([label, value, note]) => (
              <div key={label} className="rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">{label}: {value}</p>
                <p className="mt-1 text-[var(--muted)]">{note}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-[var(--line)] p-4">
              <p className="font-semibold">Future workers</p>
              <p className="mt-1 text-[var(--muted)]">{data.futureWorkers.join(' | ')}</p>
            </div>
          </div>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}
