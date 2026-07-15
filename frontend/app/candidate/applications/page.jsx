import { Sidebar } from '@/components/layout/sidebar';
import { ApplicationsList } from '@/components/sections/applications-list';
import { candidateNav } from '@/lib/mock-data';
import { getCandidateApplications } from '@/lib/api';

export default async function CandidateApplicationsPage() {
  const applications = await getCandidateApplications();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="CareerCraft AI" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Job application flow</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Track every stage after you apply</h1>
        </div>
        <ApplicationsList
          applications={applications.map((application) => ({
            id: application.id,
            role: application.job.title,
            company: application.job.recruiter?.recruiterProfile?.companyName || 'Careeriz employer',
            location: application.job.location,
            summary: application.coverLetter || 'Application submitted through Careeriz.',
            tone: application.currentStage === 'REJECTED' ? 'warning' : 'success',
            status: application.statusLabel,
            date: new Date(application.appliedAt).toLocaleDateString(),
          }))}
        />
      </section>
    </main>
  );
}

