import { Sidebar } from '@/components/layout/sidebar';
import { ApplicationsList } from '@/components/sections/applications-list';
import { candidateNav } from '@/lib/navigation';
import { getCandidateApplications } from '@/lib/api';

export default async function CandidateApplicationsPage() {
  const applications = await getCandidateApplications();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Job application flow</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Track every stage after you apply</h1>
        </div>
        <ApplicationsList
          applications={applications.map((application) => ({
            id: application.id,
            role: application.job.title,
            company: application.job.organisation?.name || 'Careeriz employer',
            location: application.job.slug,
            summary: `Reference ${application.publicReference}${application.resume?.filename ? ` • Resume ${application.resume.filename}` : ''}`,
            tone: application.stage === 'REJECTED' ? 'warning' : 'success',
            status: application.status,
            date: new Date(application.submittedAt).toLocaleDateString(),
          }))}
        />
      </section>
    </main>
  );
}

