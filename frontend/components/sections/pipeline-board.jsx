import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const columns = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { key: 'SELECTED', label: 'Selected' },
  { key: 'REJECTED', label: 'Rejected' },
];

export function PipelineBoard({ applications }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">ATS pipeline</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Designed as draggable columns in the live implementation.</p>
        </div>
        <Badge tone="brand">Drag-and-drop ready</Badge>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const items = applications.filter((app) => app.currentStage === column.key);
          return (
            <div key={column.key} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{column.label}</p>
                <Badge>{items.length}</Badge>
              </div>
              <div className="mt-3 space-y-3">
                {items.map((app) => (
                  <div key={app.id} className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className="font-semibold">{app.candidate}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{app.role}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">{app.timeline}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

