import Link from 'next/link';
import { MapPin, BriefcaseBusiness, Building2, Bookmark, CalendarDays, IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatJobSalaryRange } from '@/lib/recruitment-formatters';

function formatExperience(job) {
  return `${job.experienceMin}-${job.experienceMax} years`;
}

export function PublicJobCard({ job, saveAction = null, unsaveAction = null, redirectTo = '/jobs' }) {
  const action = job.saved ? unsaveAction : saveAction;

  return (
    <Card as="article" variant="interactive" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple">{job.workplaceType || 'Flexible'}</Badge>
            <Badge variant="neutral">{job.employmentType.replaceAll('_', ' ')}</Badge>
          </div>
          <Link href={`/jobs/${job.slug}`} className="block text-lg font-semibold text-[var(--color-text)] transition hover:text-[var(--color-primary)]">
            {job.title}
          </Link>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5"><Building2 size={14} aria-hidden="true" /> {job.organisation?.name || 'Careeriz employer'}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> {job.location}</span>
            <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={14} aria-hidden="true" /> {formatExperience(job)}</span>
          </div>
        </div>
        {action ? (
          <form action={action}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" variant={job.saved ? 'secondary' : 'outline'} size="sm">
              <Bookmark size={16} aria-hidden="true" />
              {job.saved ? 'Saved' : 'Save'}
            </Button>
          </form>
        ) : null}
      </div>
      {job.skillsRequired?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skillsRequired.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
              {skill}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5"><IndianRupee size={14} aria-hidden="true" /> {formatJobSalaryRange(job)}</span>
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" /> Posted {new Date(job.postedAt).toLocaleDateString()}</span>
      </div>
    </Card>
  );
}
