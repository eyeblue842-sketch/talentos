import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { CandidateApplicationDetailView } from '@/components/sections/candidate-application-detail-view';
import { getCandidateApplication, getCandidateOfferForApplication } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';

export default async function CandidateApplicationDetailPage({ params }) {
  const { applicationId } = await params;
  const application = await getCandidateApplication(applicationId);
  const offer = application.applicationId ? await getCandidateOfferForApplication(application.applicationId) : null;

  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
      <CandidateApplicationDetailView application={application} offer={offer} />
    </CareerizAppShell>
  );
}
