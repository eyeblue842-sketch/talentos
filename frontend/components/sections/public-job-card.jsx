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
    <Card as="article" variant="interactive" className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple">{job.workplaceType || 'Flexible'}</Badge>
            <Badge variant="neutral">{job.employmentType.replaceAll('_', ' ')}</Badge>
          </div>
          <div>
            <Link href={`/jobs/${job.slug}`} className="text-2xl font-semibold text-[var(--color-text)] transition hover:text-[var(--color-primary)]">
              {job.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-2"><Building2 size={15} aria-hidden="true" /> {job.organisation?.name || 'Careeriz employer'}</span>
              <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden="true" /> {job.location}</span>
              <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={15} aria-hidden="true" /> {formatExperience(job)}</span>
            </div>
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
      <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{job.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {job.skillsRequired.slice(0, 5).map((skill) => (
          <span key={skill} className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-2"><IndianRupee size={15} aria-hidden="true" /> {formatJobSalaryRange(job)}</span>
        <span className="inline-flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" /> Posted {new Date(job.postedAt).toLocaleDateString()}</span>
      </div>
    </Card>
  );
}
