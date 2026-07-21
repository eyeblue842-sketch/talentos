import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatMoney(amount, currency = 'INR') {
  if (amount == null) return 'Not specified';
  return `${currency} ${Number(amount).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return 'Not specified';
  return new Date(value).toLocaleDateString();
}

function statusTone(status) {
  if (['ACCEPTED', 'JOINING_CONFIRMED', 'JOINED'].includes(status)) return 'success';
  if (['REJECTED', 'WITHDRAWN', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'danger';
  if (['RELEASED', 'VIEWED'].includes(status)) return 'brand';
  return 'neutral';
}

export function OfferExperiencePanel({
  offer,
  acceptAction,
  rejectAction,
  requestRevisionAction,
  tokenValue = null,
  title = 'Offer detail',
  description = 'Review your offer, download the PDF, and respond securely.',
}) {
  if (!offer) {
    return (
      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Offer unavailable</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">The requested offer is not available.</p>
      </Card>
    );
  }

  const actionable = ['RELEASED', 'VIEWED'].includes(offer.status);

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">{offer.organisation?.name || 'Careeriz Hire'}</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
            <p className="mt-3 text-sm text-[var(--muted)]">Ref {offer.referenceNumber} | Version {offer.version}</p>
          </div>
          <Badge tone={statusTone(offer.status)}>{offer.status.replaceAll('_', ' ')}</Badge>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <p><span className="font-semibold">Candidate:</span> {offer.candidate?.fullName || 'Not specified'}</p>
            <p><span className="font-semibold">Role:</span> {offer.job?.title || 'Not specified'}</p>
            <p><span className="font-semibold">Department:</span> {offer.departmentSnapshot || offer.job?.department || 'Not specified'}</p>
            <p><span className="font-semibold">Location:</span> {offer.workLocation || offer.job?.location || 'Not specified'}</p>
            <p><span className="font-semibold">Employment:</span> {offer.employmentTypeSnapshot || offer.job?.employmentType || 'Not specified'}</p>
            <p><span className="font-semibold">Joining date:</span> {formatDate(offer.proposedJoiningDate)}</p>
            <p><span className="font-semibold">Expiry:</span> {formatDate(offer.expiryAt)}</p>
            <p><span className="font-semibold">Download:</span> <a className="text-[var(--brand)]" href={offer.pdfDownloadUrl}>Download PDF</a></p>
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Compensation</h2>
          <div className="mt-5 space-y-3 text-sm">
            <p><span className="font-semibold">Annual compensation:</span> {formatMoney(offer.annualCompensation, offer.currency)}</p>
            <p><span className="font-semibold">Fixed compensation:</span> {formatMoney(offer.fixedCompensation, offer.currency)}</p>
            <p><span className="font-semibold">Variable compensation:</span> {formatMoney(offer.variableCompensation, offer.currency)}</p>
            <p><span className="font-semibold">Joining bonus:</span> {formatMoney(offer.joiningBonus, offer.currency)}</p>
            <p><span className="font-semibold">Other compensation:</span> {formatMoney(offer.otherCompensation, offer.currency)}</p>
            <p><span className="font-semibold">Total package:</span> {formatMoney(offer.totalCompensation, offer.currency)}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Terms</h2>
          <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
            <p>{offer.termsAndConditions || 'Standard terms and company policies apply.'}</p>
            {offer.components?.length ? (
              <div className="rounded-2xl border border-[var(--line)] p-4 text-[var(--text)]">
                <p className="font-semibold">Custom components</p>
                <div className="mt-3 space-y-2">
                  {offer.components.map((component) => (
                    <div key={component.id || `${component.label}-${component.displayOrder}`} className="flex items-center justify-between gap-3">
                      <span>{component.label}</span>
                      <span className="font-semibold">{formatMoney(component.amount, offer.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Status</h2>
          <div className="mt-5 space-y-3 text-sm">
            <p><span className="font-semibold">Released:</span> {formatDate(offer.releasedAt)}</p>
            <p><span className="font-semibold">Viewed:</span> {formatDate(offer.viewedAt)}</p>
            <p><span className="font-semibold">Accepted:</span> {formatDate(offer.acceptedAt)}</p>
            <p><span className="font-semibold">Rejected:</span> {formatDate(offer.rejectedAt)}</p>
            <p><span className="font-semibold">Joining confirmed:</span> {formatDate(offer.joiningConfirmedAt)}</p>
            <p><span className="font-semibold">Actual joining:</span> {formatDate(offer.actualJoiningDate)}</p>
            {offer.candidateResponseReason ? <p><span className="font-semibold">Latest response:</span> {offer.candidateResponseReason}</p> : null}
          </div>
        </Card>
      </div>

      {actionable ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
          <Card>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">Accept offer</h2>
            <form action={acceptAction} className="mt-4 space-y-3">
              <input type="hidden" name={tokenValue ? 'token' : 'offerId'} value={tokenValue || offer.id} />
              <textarea name="comment" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" placeholder="Optional note for the recruiter." />
              <button className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Accept offer</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">Reject offer</h2>
            <form action={rejectAction} className="mt-4 space-y-3">
              <input type="hidden" name={tokenValue ? 'token' : 'offerId'} value={tokenValue || offer.id} />
              <input name="reason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" placeholder="Reason for rejection" required />
              <textarea name="comment" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" placeholder="Optional context." />
              <button className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Reject offer</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-[var(--font-display)] text-xl font-semibold">Request revision</h2>
            <form action={requestRevisionAction} className="mt-4 space-y-3">
              <input type="hidden" name={tokenValue ? 'token' : 'offerId'} value={tokenValue || offer.id} />
              <textarea name="comment" className="min-h-28 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" placeholder="What would you like clarified or revised?" required />
              <button className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Request revision</button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
