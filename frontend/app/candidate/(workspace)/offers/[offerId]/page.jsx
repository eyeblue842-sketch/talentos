import { Sidebar } from '@/components/layout/sidebar';
import { OfferExperiencePanel } from '@/components/sections/offer-experience-panel';
import { candidateNav } from '@/lib/navigation';
import { getCandidateOffer } from '@/lib/api';
import {
  acceptCandidateOfferDirectAction,
  rejectCandidateOfferDirectAction,
  requestCandidateOfferRevisionDirectAction,
} from '../../../actions';

export default async function CandidateOfferPage({ params }) {
  const { offerId } = await params;
  const offer = await getCandidateOffer(offerId);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section>
        <OfferExperiencePanel
          offer={offer}
          acceptAction={acceptCandidateOfferDirectAction}
          rejectAction={rejectCandidateOfferDirectAction}
          requestRevisionAction={requestCandidateOfferRevisionDirectAction}
          title="Review your offer"
          description="Download the latest document, review compensation and terms, and record your response."
        />
      </section>
    </main>
  );
}
