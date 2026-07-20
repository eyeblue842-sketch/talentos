import Link from 'next/link';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { StatusIndicator } from '@/components/ui/status-indicator';

export function JobsTable({ jobs, title = 'Organisation jobs', helper = 'Track publishing, applicants, and ownership.' }) {
  return (
    <DataTableShell
      title={title}
      description={helper}
      emptyState={!jobs.length ? {
        title: 'No jobs created yet',
        description: 'New requisitions and published roles will appear here once your team starts hiring.',
      } : null}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Applicants</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-[var(--color-border)] align-top">
                <td className="px-4 py-4">
                  <Link href={`/recruiter/jobs/${job.id}`} className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                    {job.title}
                  </Link>
                  <p className="text-[var(--color-text-muted)]">
                    {job.employmentType}
                    {job.workplaceType ? ` | ${job.workplaceType}` : ''}
                  </p>
                  <p className="text-[var(--color-text-muted)]">{job.requisition?.requisitionCode || 'No requisition linked'}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusIndicator status={job.status} />
                </td>
                <td className="px-4 py-4 text-[var(--color-text-secondary)]">{job.location}</td>
                <td className="px-4 py-4 text-[var(--color-text-secondary)]">{job.applicationsCount || 0}</td>
                <td className="px-4 py-4 text-[var(--color-text-secondary)]">{job.recruiter?.email || 'Unassigned'}</td>
                <td className="px-4 py-4 text-[var(--color-text-secondary)]">{new Date(job.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataTableShell>
  );
}
