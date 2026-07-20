import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getNotifications } from '@/lib/api';
import { markNotificationReadAction } from '../actions';

function entityLink(notification) {
  if (notification.entityType === 'Application' && notification.entityId) {
    return `/recruiter/ats/${notification.entityId}`;
  }
  if (notification.entityType === 'Job' && notification.entityId) {
    return `/recruiter/jobs/${notification.entityId}`;
  }
  return null;
}

export default async function RecruiterNotificationsPage() {
  let organisation = null;
  let notifications = [];
  let error = '';

  try {
    [organisation, notifications] = await Promise.all([
      getCurrentOrganisation(),
      getNotifications(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Notifications"
        description="Track organisation-scoped job, application, interview, and membership events."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Notifications' }]}
      />
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Inbox</h2>
          {error ? <p className="mt-3 text-sm text-[var(--muted)]">{error}</p> : null}
          {!error && notifications.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No in-app notifications for this organisation context.</p> : null}
          {!error && notifications.length > 0 ? (
            <div className="mt-5 space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{notification.title}</p>
                      <p className="text-sm text-[var(--muted)]">{notification.message}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={notification.readAt ? 'neutral' : 'brand'}>{notification.readAt ? 'READ' : 'UNREAD'}</Badge>
                      {!notification.readAt ? (
                        <form action={markNotificationReadAction.bind(null, notification.id)}>
                          <button className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">Mark read</button>
                        </form>
                      ) : null}
                      {entityLink(notification) ? <Link href={entityLink(notification)} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">Open</Link> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
    </WorkspaceShell>
  );
}
