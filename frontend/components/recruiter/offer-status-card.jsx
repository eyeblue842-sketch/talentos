import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Compact offer summary shown on the application detail page. The full offer
// form lives on the ATS "Offer" stage (move-to-offer popup), so this only
// surfaces whether an offer exists, its status, amount, and a download link.
export function OfferStatusCard({ offers = [], applicationId }) {
  const offer = offers[0] || null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Offer</h2>
        {offer ? <Badge tone={offer.status === 'ACCEPTED' ? 'success' : offer.status === 'RELEASED' ? 'info' : 'neutral'}>{String(offer.status || '').replaceAll('_', ' ')}</Badge> : <Badge tone="neutral">No offer yet</Badge>}
      </div>
      {offer ? (
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="font-semibold">Reference:</span> {offer.referenceNumber || '—'}</p>
          <p><span className="font-semibold">Compensation:</span> {offer.currency || 'INR'} {offer.totalCompensation ?? offer.annualCompensation ?? '—'}</p>
          {offer.proposedJoiningDate ? <p><span className="font-semibold">Proposed joining:</span> {new Date(offer.proposedJoiningDate).toLocaleDateString()}</p> : null}
          <a href={`/api/offers/${offer.id}/document`} className="mt-1 inline-flex font-semibold text-[var(--brand)]">Download offer letter</a>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No offer has been created. Move this candidate to the <span className="font-semibold">Offer</span> stage in the ATS pipeline to generate one.</p>
      )}
    </Card>
  );
}
