import Link from 'next/link';
import { MapPin, BriefcaseBusiness, Building2, Bookmark, CalendarDays, IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function formatSalary(job) {
  if (!job.salaryMin && !job.salaryMax) return 'Compensation not disclosed';
  const parts = [job.salaryMin, job.salaryMax]
    .filter((value) => value != null)
    .map((value) => `${job.currency || 'INR'} ${value} LPA`);
  return parts.join(' - ');
}

function formatExperience(job) {
  return `${job.experienceMin}-${job.experienceMax} years`;
}

export function PublicJobCard({ job, saveAction = null, unsaveAction = null, redirectTo = '/jobs' }) {
  const action = job.saved ? unsaveAction : saveAction;

  return (
    <article className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{job.workplaceType || 'Flexible'}</Badge>
            <Badge>{job.employmentType.replaceAll('_', ' ')}</Badge>
          </div>
          <div>
            <Link href={`/jobs/${job.slug}`} className="font-[var(--font-display)] text-2xl font-semibold text-[var(--text)] transition hover:text-[var(--brand)]">
              {job.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2"><Building2 size={15} /> {job.organisation?.name || 'Careeriz employer'}</span>
              <span className="inline-flex items-center gap-2"><MapPin size={15} /> {job.location}</span>
              <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={15} /> {formatExperience(job)}</span>
            </div>
          </div>
        </div>
        {action ? (
          <form action={action}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
              <Bookmark size={15} />
              {job.saved ? 'Saved' : 'Save'}
            </button>
          </form>
        ) : null}
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{job.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {job.skillsRequired.slice(0, 5).map((skill) => (
          <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <span className="inline-flex items-center gap-2"><IndianRupee size={15} /> {formatSalary(job)}</span>
        <span className="inline-flex items-center gap-2"><CalendarDays size={15} /> Posted {new Date(job.postedAt).toLocaleDateString()}</span>
      </div>
    </article>
  );
}

