import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function statusTone(status) {
  if (status === 'OPEN') return 'success';
  if (status === 'DRAFT' || status === 'ON_HOLD') return 'warning';
  if (status === 'ARCHIVED') return 'neutral';
  return 'danger';
}

export function JobsTable({ jobs, title = 'Organisation jobs', helper = 'Track publishing, applicants, and ownership.' }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{helper}</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="pb-3 font-medium">Job</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Location</th>
              <th className="pb-3 font-medium">Applicants</th>
              <th className="pb-3 font-medium">Owner</th>
              <th className="pb-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-[var(--line)] align-top">
                <td className="py-4">
                  <Link href={`/recruiter/jobs/${job.id}`} className="font-semibold hover:underline">{job.title}</Link>
                  <p className="text-[var(--muted)]">{job.employmentType} {job.workplaceType ? `• ${job.workplaceType}` : ''}</p>
                  <p className="text-[var(--muted)]">{job.requisition?.requisitionCode || 'No requisition linked'}</p>
                </td>
                <td className="py-4">
                  <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                </td>
                <td className="py-4">{job.location}</td>
                <td className="py-4">{job.applicationsCount || 0}</td>
                <td className="py-4">{job.recruiter?.email || 'Unassigned'}</td>
                <td className="py-4">{new Date(job.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
