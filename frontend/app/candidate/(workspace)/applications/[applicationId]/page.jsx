import { Sidebar } from '@/components/layout/sidebar';
import { CandidateApplicationDetailView } from '@/components/sections/candidate-application-detail-view';
import { getCandidateApplication } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';

export default async function CandidateApplicationDetailPage({ params }) {
  const { applicationId } = await params;
  const application = await getCandidateApplication(applicationId);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section>
        <CandidateApplicationDetailView application={application} />
      </section>
    </main>
  );
}
