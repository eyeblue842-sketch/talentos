"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, Clock, MapPin, Pencil, Users, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RecruiterJobEditForm } from '@/components/sections/recruiter-job-edit-form';

function statusTone(status) {
  if (status === 'OPEN') return 'success';
  if (status === 'DRAFT' || status === 'ON_HOLD') return 'warning';
  if (status === 'ARCHIVED') return 'neutral';
  return 'danger';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}

/**
 * Recruiter-facing job detail. Defaults to a clean, candidate-style PREVIEW of
 * the job post with an explicit "Edit job" toggle that reveals the structured
 * edit form inline (LinkedIn/Naukri-style read-first workflow), replacing the
 * previous always-open long edit form. This is a recruiter preview - NOT the
 * shared public renderer (that is UX-3) - so it can safely show internal
 * signals like status, hidden-salary and pipeline summary.
 */
export function RecruiterJobDetailView({
  job,
  assignees = [],
  requisitions = [],
  updateJobAction,
  closeReopenAction,
  archiveAction,
  deleteAction,
  atsHref,
}) {
  const [mode, setMode] = useState('preview');

  const locations = job.locations?.length
    ? job.locations.map((entry) => entry.name || entry).join(', ')
    : job.location;
  const salaryText = job.salaryMin != null || job.salaryMax != null
    ? `${job.currency || 'INR'} ${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} LPA`
    : 'Not set';
  const skills = job.skillsRequired || [];
  const responsibilities = job.responsibilities || [];

  if (mode === 'edit') {
    return (
      <Card className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-primary)]">Editing job</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{job.title}</h2>
          </div>
          <Button type="button" variant="outline" onClick={() => setMode('preview')}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to preview
          </Button>
        </div>
        <RecruiterJobEditForm
          job={job}
          assignees={assignees}
          requisitions={requisitions}
          updateJobAction={updateJobAction}
        />
      </Card>
    );
  }

  return (
    <Card className="grid gap-6">
      {/* Header: title, status, and primary actions */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-[var(--color-text)]">{job.title}</h1>
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
          </div>
          <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{job.organisation?.name || 'Careeriz employer'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setMode('edit')}>
            <Pencil size={16} aria-hidden="true" />
            Edit job
          </Button>
          <form action={closeReopenAction}>
            <input type="hidden" name="status" value={job.status === 'OPEN' ? 'CLOSED' : 'OPEN'} />
            <Button type="submit" variant="outline">{job.status === 'OPEN' ? 'Close job' : 'Open job'}</Button>
          </form>
          <form action={archiveAction}>
            <input type="hidden" name="status" value="ARCHIVED" />
            <Button type="submit" variant="outline">Archive</Button>
          </form>
          <form action={deleteAction}>
            <Button type="submit" variant="danger">Delete</Button>
          </form>
        </div>
      </div>

      {/* Job highlights */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Fact icon={MapPin} label="Location" value={locations || 'Remote'} />
        <Fact icon={BriefcaseBusiness} label="Workplace" value={job.workplaceType || 'Not set'} />
        <Fact icon={Clock} label="Experience" value={`${job.experienceMin ?? 0}-${job.experienceMax ?? 0} years`} />
        <Fact icon={BriefcaseBusiness} label="Employment" value={job.employmentType || 'Not set'} />
        <Fact icon={Users} label="Openings" value={job.numberOfOpenings || 1} />
        <Fact
          icon={Wallet}
          label="Salary"
          value={(
            <>
              {salaryText}
              {!job.publicSalaryEnabled ? <span className="ml-1 text-xs font-semibold text-amber-600">(hidden from candidates)</span> : null}
            </>
          )}
        />
      </div>

      {skills.length ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Key skills</h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{skill}</span>
            ))}
          </div>
        </div>
      ) : null}

      {job.description ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Job description</h3>
          <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)]">{job.description}</p>
        </div>
      ) : null}

      {responsibilities.length ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Key responsibilities</h3>
          <ul className="grid gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {responsibilities.map((item) => <li key={item} className="list-inside list-disc">{item}</li>)}
          </ul>
        </div>
      ) : null}

      {/* Job information */}
      <div className="grid gap-4 rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)] px-4 py-4 sm:grid-cols-2">
        <div className="grid gap-2 text-sm">
          <p><span className="font-semibold text-[var(--color-text)]">Applications open:</span> {formatDate(job.applicationOpensAt) || 'Immediate'}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Application deadline:</span> {formatDate(job.applicationDeadline) || 'Not set'}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Visibility:</span> {job.visibility}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Applicants:</span> {job.applicationsCount || 0}</p>
        </div>
        <div className="grid gap-2 text-sm">
          <p><span className="font-semibold text-[var(--color-text)]">Recruiter owner:</span> {job.recruiter?.email || 'Unassigned'}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Hiring manager:</span> {job.hiringManager?.email || 'Unassigned'}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Department:</span> {job.department || 'Not set'}</p>
          <p><span className="font-semibold text-[var(--color-text)]">Pipeline:</span> {job.pipelineSummary?.map((item) => `${item.stage}: ${item.count}`).join(', ') || 'No applicants yet'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setMode('edit')}>
          <Pencil size={16} aria-hidden="true" />
          Edit job
        </Button>
        {atsHref ? (
          <Link href={atsHref} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-border-strong)]">
            Open ATS pipeline
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
