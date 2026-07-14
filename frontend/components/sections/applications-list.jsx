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
              <p className="mt-1 text-sm text-[var(--muted)]">{application.company} • {application.location}</p>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{application.summary}</p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Badge tone={application.tone}>{application.status}</Badge>
              <span className="text-sm text-[var(--muted)]">{application.date}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

