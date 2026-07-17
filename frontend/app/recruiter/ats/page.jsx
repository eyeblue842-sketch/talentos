import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getRecruiterApplicationsV2 } from '@/lib/api';
import { moveApplicationStageAction } from '../actions';

const stages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];

export default async function RecruiterAtsPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params?.jobId) query.set('jobId', params.jobId);
  if (params?.stage) query.set('stage', params.stage);

  let pipeline = { items: [], meta: {} };
  let error = '';

  try {
    pipeline = await getRecruiterApplicationsV2(query.toString());
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">ATS pipeline</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Organisation-scoped applications grouped by stage with real backend transitions. This phase uses explicit stage controls instead of drag-and-drop to reduce workflow risk.</p>
        </Card>

        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}

        {!error ? (
          <div className="grid gap-4 xl:grid-cols-5">
            {stages.map((stage) => {
              const items = pipeline.items.filter((application) => application.stage === stage);
              return (
                <Card key={stage} className="bg-[var(--surface)]">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{stage.replaceAll('_', ' ')}</p>
                    <Badge tone="brand">{items.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {items.length === 0 ? <p className="text-sm text-[var(--muted)]">No applications.</p> : null}
                    {items.map((application) => (
                      <div key={application.id} className="rounded-2xl border border-[var(--line)] bg-white p-3 text-sm">
                        <p className="font-semibold">{application.candidate.fullName}</p>
                        <p className="text-[var(--muted)]">Reference {application.publicReference}</p>
                        <p className="mt-1 text-[var(--muted)]">{application.job.title}</p>
                        <p className="mt-1 text-[var(--muted)]">Applied {new Date(application.submittedAt).toLocaleDateString()}</p>
                        <p className="mt-1 text-[var(--muted)]">Flags: {application.flagCount} • Source: {application.source?.sourceName || application.source?.sourceType || 'Unknown'}</p>
                        <form action={moveApplicationStageAction.bind(null, application.applicationId || application.id)} className="mt-3 space-y-2">
                          <select name="stage" defaultValue={application.stage} className="w-full rounded-2xl border border-[var(--line)] px-3 py-2">
                            {stages.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <button className="w-full rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Move stage</button>
                        </form>
                        <Link href={`/recruiter/ats/${application.id}`} className="mt-3 inline-flex font-semibold text-[var(--brand)]">Open application</Link>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
