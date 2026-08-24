import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { candidateNav } from '@/lib/navigation';
import { getCandidateNotifications } from '@/lib/api';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/candidate/actions';
import { buildPathWithQuery, withPage } from '@/lib/query';

export default async function CandidateNotificationsPage({ searchParams }) {
  const params = await searchParams;
  const notifications = await getCandidateNotifications(params || {});
  if (String(params?.page || '1') !== String(notifications.meta.page)) {
    redirect(buildPathWithQuery('/candidate/notifications', withPage(params || {}, notifications.meta.page)));
  }

  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Notifications</p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Stay current on candidate activity</h1>
          </div>
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)]">Mark all read</button>
          </form>
        </div>
        {notifications.items.length ? notifications.items.map((notification) => (
          <Card key={notification.id} className="rounded-[28px] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold">{notification.title}</h2>
                  {notification.isUnread ? <Badge tone="brand">Unread</Badge> : <Badge>Read</Badge>}
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{notification.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{new Date(notification.createdAt).toLocaleString()}</p>
                <Link href={notification.link} className="mt-3 inline-flex text-sm font-semibold text-[var(--brand)]">Open update</Link>
              </div>
              {notification.isUnread ? (
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <button type="submit" className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Mark read</button>
                </form>
              ) : null}
            </div>
          </Card>
        )) : (
          <Card className="rounded-[28px] p-10 text-center text-[var(--muted)]">
            You have no notifications yet.
          </Card>
        )}
        <PaginationNav basePath="/candidate/notifications" params={params || {}} meta={notifications.meta} />
    </CareerizAppShell>
  );
}
