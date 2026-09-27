"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

// Lets the recruiter pick which open position (from the ATS) to run the AI match
// against. Selecting a job reloads the profile on the AI Match tab with that job.
export function AiMatchJobSelector({ jobs = [], currentJobId = '' }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(event) {
    const jobId = event.target.value;
    const params = new URLSearchParams();
    params.set('tab', 'ai-match');
    if (jobId) params.set('jobId', jobId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 max-w-md">
      <Select label="Match against job opening" value={currentJobId} onChange={onChange}>
        <option value="">Select a job opening…</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>{job.title}</option>
        ))}
      </Select>
      {jobs.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">No open positions yet. Publish a job to run an AI match.</p>
      ) : null}
    </div>
  );
}
