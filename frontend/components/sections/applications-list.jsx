import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ApplicationsList({ applications }) {
  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <Card key={application.id}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-[var(--font-display)] text-xl font-semibold">{application.role}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{application.company} | {application.location}</p>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{application.summary}</p>
              {application.latestUpdate ? <p className="mt-3 text-sm text-[var(--text)]">{application.latestUpdate}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {application.reference ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Ref {application.reference}</span> : null}
                {application.href ? <Link href={application.href} className="text-sm font-semibold text-[var(--brand)]">View application</Link> : null}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Badge tone={application.tone}>{application.status}</Badge>
              {application.stage ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{application.stage.replaceAll('_', ' ')}</span> : null}
              <span className="text-sm text-[var(--muted)]">{application.date}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
