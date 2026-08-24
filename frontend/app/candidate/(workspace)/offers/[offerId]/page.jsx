import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
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
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
      <OfferExperiencePanel
        offer={offer}
        acceptAction={acceptCandidateOfferDirectAction}
        rejectAction={rejectCandidateOfferDirectAction}
        requestRevisionAction={requestCandidateOfferRevisionDirectAction}
        title="Review your offer"
        description="Download the latest document, review compensation and terms, and record your response."
      />
    </CareerizAppShell>
  );
}
