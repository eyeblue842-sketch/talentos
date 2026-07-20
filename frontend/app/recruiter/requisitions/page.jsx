import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterJobs, getRequisitions } from '@/lib/api';

export default async function RecruiterRequisitionsPage() {
  let organisation = null;
  let requisitions = [];
  let jobs = [];
  let error = '';

  try {
    [organisation, requisitions, jobs] = await Promise.all([
      getCurrentOrganisation(),
      getRequisitions(),
      getRecruiterJobs(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Requisitions"
        description="Review requisitions, see linked jobs, and move approved requirements into hiring execution."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Requisitions' }]}
      />
      <Card className="bg-[var(--surface)]">
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Requisition continuity</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Approved requisitions can move directly into job creation, resume search, and ATS when a linked job already exists.</p>
      </Card>

      <Card>
        {error ? <p className="text-sm text-[var(--muted)]">{error}</p> : null}
        {!error && requisitions.length === 0 ? <p className="text-sm text-[var(--muted)]">No requisitions exist yet. Create them through the existing requisition API flow.</p> : null}
        {!error && requisitions.length > 0 ? (
          <div className="space-y-3">
            {requisitions.map((requisition) => {
              const linkedJob = jobs.find((job) => job.requisitionId === requisition.id) || null;
              const createHref = `/recruiter/jobs?fromRequisition=${encodeURIComponent(requisition.id)}&title=${encodeURIComponent(requisition.title)}&location=${encodeURIComponent(requisition.location || '')}&department=${encodeURIComponent(requisition.department || '')}&businessUnit=${encodeURIComponent(requisition.businessUnit || '')}&employmentType=${encodeURIComponent(requisition.employmentType || 'FULL_TIME')}&numberOfOpenings=${encodeURIComponent(String(requisition.numberOfOpenings || 1))}`;

              return (
                <div key={requisition.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{requisition.title}</p>
                      <p className="text-sm text-[var(--muted)]">{requisition.requisitionCode} • {requisition.department || 'Department pending'} • {requisition.location || 'Location pending'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge tone="brand">{requisition.priority}</Badge>
                      <Badge tone={requisition.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>{requisition.approvalStatus}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)]">Status: {requisition.status} • Openings: {requisition.numberOfOpenings}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {linkedJob ? (
                      <>
                        <Badge tone="success">Linked job: {linkedJob.status}</Badge>
                        <Link href={`/recruiter/jobs/${linkedJob.id}`} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">Open Job</Link>
                        <Link href={`/recruiter/database?jobId=${linkedJob.id}${linkedJob.requisitionId ? `&requisitionId=${linkedJob.requisitionId}` : ''}`} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">Resume Search</Link>
                        <Link href={`/recruiter/ats?jobId=${linkedJob.id}`} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">ATS</Link>
                      </>
                    ) : requisition.approvalStatus === 'APPROVED' ? (
                      <Link href={createHref} className="rounded-2xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white">Create Job from Requisition</Link>
                    ) : (
                      <Badge tone="warning">Approve requisition before job creation</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>
    </WorkspaceShell>
  );
}
