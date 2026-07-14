import { Sidebar } from '@/components/layout/sidebar';
import { PipelineBoard } from '@/components/sections/pipeline-board';
import { Card } from '@/components/ui/card';
import { pipelineApplications, recruiterNav } from '@/lib/mock-data';

export default function RecruiterAtsPage() {
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
        <PipelineBoard applications={pipelineApplications} />
      </section>
    </main>
  );
}

