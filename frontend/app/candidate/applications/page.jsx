import { Sidebar } from '@/components/layout/sidebar';
import { ApplicationsList } from '@/components/sections/applications-list';
import { candidateApplications, candidateNav } from '@/lib/mock-data';

export default function CandidateApplicationsPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="CareerCraft AI" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Job application flow</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Track every stage after you apply</h1>
        </div>
        <ApplicationsList applications={candidateApplications} />
      </section>
    </main>
  );
}

