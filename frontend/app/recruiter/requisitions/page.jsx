import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getRequisitions } from '@/lib/api';

export default async function RecruiterRequisitionsPage() {
  let requisitions = [];
  let error = '';

  try {
    requisitions = await getRequisitions();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Requisition foundation</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">This Phase 2 page is backed by live organisation requisitions and exposes explicit empty and error states without mock data.</p>
        </Card>

        <Card>
          {error ? <p className="text-sm text-[var(--muted)]">{error}</p> : null}
          {!error && requisitions.length === 0 ? <p className="text-sm text-[var(--muted)]">No requisitions exist yet. Create them through the backend Phase 2 API or seed flow.</p> : null}
          {!error && requisitions.length > 0 ? (
            <div className="space-y-3">
              {requisitions.map((requisition) => (
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
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
