import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getNotifications } from '@/lib/api';
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
  let notifications = [];
  let error = '';

  try {
    notifications = await getNotifications();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card>
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Notifications</h1>
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
      </section>
    </main>
  );
}
