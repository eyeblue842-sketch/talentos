import { BriefcaseBusiness, MapPin, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function JobGrid({ jobs }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {jobs.map((job) => (
        <Card key={job.id} className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_18px_48px_rgba(16,36,24,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{job.type}</Badge>
                {job.urgency ? <Badge tone="warning">{job.urgency}</Badge> : null}
              </div>
              <h3 className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight">{job.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{job.company} · {job.location}</p>
            </div>
            <div className="rounded-[22px] bg-[var(--soft)] px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Candidate fit</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--brand)]">{job.match}%</p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{job.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
                {skill}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Wallet size={15} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Salary</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{job.salary}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <MapPin size={15} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Location</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{job.location}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <BriefcaseBusiness size={15} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Work mode</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{job.type}</p>
            </div>
          </div>

          {job.highlights?.length ? (
            <div className="mt-6 space-y-2 text-sm text-[var(--muted)]">
              {job.highlights.map((highlight) => (
                <div key={highlight} className="flex gap-2">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
