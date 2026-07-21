import { OfferExperiencePanel } from '@/components/sections/offer-experience-panel';
import { getPublicOfferAccess } from '@/lib/api';
import {
  acceptPublicOfferAction,
  rejectPublicOfferAction,
  requestPublicOfferRevisionAction,
} from '../../actions';

export default async function PublicOfferAccessPage({ params }) {
  const { token } = await params;
  const offer = await getPublicOfferAccess(token);
  const publicOffer = offer ? { ...offer, pdfDownloadUrl: `/api/offers/access/${token}/pdf` } : offer;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 lg:px-10">
      <OfferExperiencePanel
        offer={publicOffer}
        tokenValue={token}
        acceptAction={acceptPublicOfferAction}
        rejectAction={rejectPublicOfferAction}
        requestRevisionAction={requestPublicOfferRevisionAction}
        title="Secure offer access"
        description="This link is specific to your current offer version and expires automatically."
      />
    </main>
  );
}
