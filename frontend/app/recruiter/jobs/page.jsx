import { Sidebar } from '@/components/layout/sidebar';
import { JobsTable } from '@/components/sections/jobs-table';
import { Card } from '@/components/ui/card';
import { recruiterJobs, recruiterNav } from '@/lib/mock-data';

export default function RecruiterJobsPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Job posting module</h1>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Job title" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Location" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Skills required" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Experience range" />
            <textarea className="md:col-span-2 min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Job description" />
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Create job</button>
          </div>
        </Card>
        <JobsTable jobs={recruiterJobs} />
      </section>
    </main>
  );
}

