import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';

const URL_SPLIT = /(https?:\/\/[^\s<>"')]+)/g;

// Careeriz job links that already render as a card are dropped from the text.
function withoutCardLinks(text, jobs) {
  if (!jobs.length) return text;
  const slugs = new Set(jobs.map((job) => job.slug));
  return text
    .replace(URL_SPLIT, (url) => {
      const match = url.replace(/[.,;:!?]+$/, '').match(/\/jobs\/([^/?#]+)\/?$/);
      return match && slugs.has(decodeURIComponent(match[1])) ? '' : url;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function LinkedText({ text }) {
  return String(text || '').split(URL_SPLIT).map((part, index) => (/^https?:\/\//.test(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-primary)] underline break-all">{part}</a>
    : <span key={index}>{part}</span>));
}

function JobCard({ job }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]" aria-hidden="true">
          <Briefcase size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-text)]">{job.title}</p>
          <p className="truncate text-sm text-[var(--color-text-secondary)]">{[job.companyName, job.location].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <Button href={job.path} size="sm">View &amp; apply</Button>
    </div>
  );
}

// Post text with clickable links, plus a job card for each Careeriz job link.
export function PostBody({ content, jobs = [], className = '' }) {
  const text = withoutCardLinks(String(content || ''), jobs);
  return (
    <div className={className}>
      {text ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-text)]"><LinkedText text={text} /></p> : null}
      {jobs.length ? <div className={`grid gap-3 ${text ? 'mt-3' : ''}`}>{jobs.map((job) => <JobCard key={job.slug} job={job} />)}</div> : null}
    </div>
  );
}
