import { Sidebar } from '@/components/layout/sidebar';
import { PipelineBoard } from '@/components/sections/pipeline-board';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/mock-data';
import { getRecruiterPipeline } from '@/lib/api';

export default async function RecruiterAtsPage() {
  const applications = (await getRecruiterPipeline()).map((application) => ({
    id: application.id,
    currentStage: application.currentStage,
    candidate: application.candidate.fullName,
    role: application.job.title,
    timeline: application.interviewScheduledAt
      ? new Date(application.interviewScheduledAt).toLocaleString()
      : new Date(application.appliedAt).toLocaleDateString(),
  }));

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">ATS pipeline</h1>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Interview date & time" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Interviewer name" />
            <textarea className="md:col-span-2 min-h-28 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Notes and activity updates" />
          </div>
        </Card>
        <PipelineBoard applications={applications} />
      </section>
    </main>
  );
}

