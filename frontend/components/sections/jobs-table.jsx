import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function JobsTable({ jobs }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Open requisitions</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Track publishing, applicants, and hiring velocity.</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="pb-3 font-medium">Role</th>
              <th className="pb-3 font-medium">Location</th>
              <th className="pb-3 font-medium">Applicants</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-[var(--line)]">
                <td className="py-4">
                  <p className="font-semibold">{job.title}</p>
                  <p className="text-[var(--muted)]">{job.skillsRequired.join(', ')}</p>
                </td>
                <td className="py-4">{job.location}</td>
                <td className="py-4">{job.applicants}</td>
                <td className="py-4">
                  <Badge tone={job.status === 'OPEN' ? 'success' : 'warning'}>{job.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

