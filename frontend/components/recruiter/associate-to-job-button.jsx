"use client";

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

// "Associate to job" clones the candidate's resume into the ATS pipeline for the
// chosen open position (creates an application at the APPLIED stage), from where
// it moves through the full ATS stages.
export function AssociateToJobButton({ candidateId, candidateName, size, variant = 'primary' }) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submittingJobId, setSubmittingJobId] = useState(null);
  const [associated, setAssociated] = useState(null); // { jobId, jobTitle }

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const response = await fetch('/api/recruiter/jobs?status=OPEN&pageSize=100', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      const items = Array.isArray(body?.data) ? body.data : (body?.data?.items || []);
      // Only open positions can receive candidates.
      setJobs(items.filter((job) => !job.status || job.status === 'OPEN'));
    } catch {
      push({ tone: 'error', title: 'Could not load jobs', description: 'Please try again.' });
    } finally {
      setLoadingJobs(false);
    }
  }, [push]);

  useEffect(() => {
    if (open) loadJobs();
  }, [open, loadJobs]);

  async function associate(job) {
    setSubmittingJobId(job.id);
    try {
      const response = await fetch('/api/recruiter/resume-search/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addToAts',
          payload: { candidateIds: [candidateId], jobId: job.id, action: 'ADD_TO_ATS' },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.message || 'Could not associate candidate.');
      }
      const item = body?.data?.items?.[0];
      if (item && item.success === false && !item.duplicate) {
        throw new Error(item.error || 'Could not associate candidate.');
      }
      const duplicate = Boolean(item?.duplicate);
      setAssociated({ jobId: job.id, jobTitle: job.title });
      push({
        tone: duplicate ? 'info' : 'success',
        title: duplicate ? 'Already in this job' : 'Associated to job',
        description: duplicate
          ? `${candidateName || 'Candidate'} is already in the pipeline for ${job.title}.`
          : `${candidateName || 'Candidate'} was added to ${job.title} and is now in the ATS pipeline.`,
      });
    } catch (error) {
      push({ tone: 'error', title: 'Association failed', description: error.message });
    } finally {
      setSubmittingJobId(null);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => { setAssociated(null); setOpen(true); }}>
        <Briefcase size={size === 'sm' ? 14 : 16} aria-hidden="true" />
        Associate to job
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Associate to job"
        description="Pick an open position. The candidate enters that job's ATS pipeline."
      >
        {associated ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <Check size={20} aria-hidden="true" />
              <p className="text-sm font-semibold">Added to {associated.jobTitle}. The resume is now in the ATS pipeline.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAssociated(null)}>Associate to another job</Button>
              <Button variant="primary" as="a" href="/recruiter/ats">Open ATS pipeline</Button>
            </div>
          </div>
        ) : loadingJobs ? (
          <div className="flex items-center gap-3 px-1 py-6 text-sm text-[var(--color-text-secondary)]">
            <LoaderCircle size={18} className="animate-spin text-[var(--color-primary)]" aria-hidden="true" />
            Loading open positions…
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No open positions"
            description="Publish a job first — open jobs appear here as positions you can associate candidates to."
            primaryAction={{ href: '/recruiter/jobs', label: 'Go to jobs' }}
          />
        ) : (
          <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{job.title}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">
                    {[job.location, job.employmentType, job.workplaceType].filter(Boolean).join(' • ') || 'Open position'}
                  </p>
                </div>
                <Button type="button" size="sm" loading={submittingJobId === job.id} disabled={Boolean(submittingJobId)} onClick={() => associate(job)}>
                  Associate
                </Button>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}
