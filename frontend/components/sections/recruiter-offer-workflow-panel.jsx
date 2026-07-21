import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatMoney(amount, currency = 'INR') {
  if (amount == null) return 'Not specified';
  return `${currency} ${Number(amount).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString();
}

function statusTone(status) {
  if (['APPROVED', 'ACCEPTED', 'JOINING_CONFIRMED', 'JOINED'].includes(status)) return 'success';
  if (['REJECTED', 'WITHDRAWN', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'danger';
  if (['PENDING_APPROVAL', 'RELEASED', 'VIEWED'].includes(status)) return 'brand';
  return 'neutral';
}

function buildDefaultOffer(offer, application) {
  return {
    currency: offer?.currency || application?.job?.currency || 'INR',
    annualCompensation: offer?.annualCompensation ?? '',
    fixedCompensation: offer?.fixedCompensation ?? '',
    variableCompensation: offer?.variableCompensation ?? '',
    joiningBonus: offer?.joiningBonus ?? '',
    retentionBonus: offer?.retentionBonus ?? '',
    allowancesAmount: offer?.allowancesAmount ?? '',
    otherCompensation: offer?.otherCompensation ?? '',
    proposedJoiningDate: offer?.proposedJoiningDate ? new Date(offer.proposedJoiningDate).toISOString().slice(0, 16) : '',
    probationPeriodMonths: offer?.probationPeriodMonths ?? '',
    workMode: offer?.workMode || application?.job?.workplaceType || '',
    workLocation: offer?.workLocation || application?.job?.location || '',
    reportingManagerName: offer?.reportingManagerName || '',
    offerExpiryDays: offer?.offerExpiryDays ?? 7,
    benefitsSummary: offer?.benefitsSummary || '',
    compensationNotes: offer?.compensationNotes || '',
    noticeOrBuyoutNote: offer?.noticeOrBuyoutNote || '',
    termsAndConditions: offer?.termsAndConditions || '',
    internalNotes: offer?.internalNotes || '',
    revisionReason: '',
  };
}

export function RecruiterOfferWorkflowPanel({
  application,
  offers = [],
  members = [],
  actions,
}) {
  const latestOffer = offers[0] || null;
  const releasedOffer = offers.find((item) => ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED', 'JOINED'].includes(item.status)) || null;
  const editableOffer = latestOffer && ['DRAFT', 'CHANGES_REQUESTED'].includes(latestOffer.status) ? latestOffer : null;
  const defaults = buildDefaultOffer(editableOffer, application);
  const draftAction = editableOffer
    ? actions.updateOfferDraftAction.bind(null, application.applicationId, editableOffer.id)
    : actions.createOfferDraftAction.bind(null, application.applicationId);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Offer and hiring lifecycle</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Draft, approve, release, revise, and close the hiring journey without leaving the ATS application workspace.</p>
          </div>
          {latestOffer ? <Badge tone={statusTone(latestOffer.status)}>{latestOffer.status.replaceAll('_', ' ')}</Badge> : null}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
              <p className="font-semibold">Eligibility</p>
              <p className="mt-2 text-[var(--muted)]">
                Current ATS state: {application.stage}. Interview decisions should move the application to <span className="font-semibold">Ready for offer</span> before drafting.
              </p>
            </div>

            <form action={draftAction} className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Currency</span>
                <input name="currency" defaultValue={defaults.currency} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Annual compensation</span>
                <input name="annualCompensation" type="number" min="0" defaultValue={defaults.annualCompensation} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Fixed compensation</span>
                <input name="fixedCompensation" type="number" min="0" defaultValue={defaults.fixedCompensation} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Variable compensation</span>
                <input name="variableCompensation" type="number" min="0" defaultValue={defaults.variableCompensation} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Joining bonus</span>
                <input name="joiningBonus" type="number" min="0" defaultValue={defaults.joiningBonus} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Retention bonus</span>
                <input name="retentionBonus" type="number" min="0" defaultValue={defaults.retentionBonus} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Other compensation</span>
                <input name="otherCompensation" type="number" min="0" defaultValue={defaults.otherCompensation} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Proposed joining date</span>
                <input name="proposedJoiningDate" type="datetime-local" defaultValue={defaults.proposedJoiningDate} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Work mode</span>
                <select name="workMode" defaultValue={defaults.workMode} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3">
                  <option value="">Use job default</option>
                  <option value="ONSITE">Onsite</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Work location</span>
                <input name="workLocation" defaultValue={defaults.workLocation} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Reporting manager</span>
                <input name="reportingManagerName" defaultValue={defaults.reportingManagerName} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Expiry days</span>
                <input name="offerExpiryDays" type="number" min="1" max="90" defaultValue={defaults.offerExpiryDays} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Benefits summary</span>
                <textarea name="benefitsSummary" defaultValue={defaults.benefitsSummary} className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Compensation notes</span>
                <textarea name="compensationNotes" defaultValue={defaults.compensationNotes} className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Terms and conditions</span>
                <textarea name="termsAndConditions" defaultValue={defaults.termsAndConditions} className="min-h-28 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Internal notes</span>
                <textarea name="internalNotes" defaultValue={defaults.internalNotes} className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <button className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white md:col-span-2">
                {editableOffer ? 'Save draft changes' : 'Create offer draft'}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
              <p className="font-semibold">Application context</p>
              <p className="mt-2 text-[var(--muted)]">{application.candidate.fullName} | {application.job.title}</p>
              <p className="mt-1 text-[var(--muted)]">Current status: {application.status}</p>
            </div>

            {latestOffer ? (
              <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{latestOffer.referenceNumber}</p>
                <p className="mt-1 text-[var(--muted)]">Version {latestOffer.version} | {latestOffer.status.replaceAll('_', ' ')}</p>
                <p className="mt-2"><span className="font-semibold">Total package:</span> {formatMoney(latestOffer.totalCompensation, latestOffer.currency)}</p>
                <p><span className="font-semibold">Joining date:</span> {formatDate(latestOffer.proposedJoiningDate)}</p>
                <p><span className="font-semibold">Expiry:</span> {formatDate(latestOffer.expiryAt)}</p>
                <p className="mt-3"><a href={latestOffer.pdfDownloadUrl} className="text-[var(--brand)]">Download PDF</a></p>
              </div>
            ) : null}

            {editableOffer ? (
              <form action={actions.requestOfferApprovalAction.bind(null, application.applicationId, editableOffer.id)} className="space-y-3 rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">Approval chain</p>
                {[0, 1, 2].map((index) => (
                  <label key={index} className="block">
                    <span className="mb-1 block font-medium">Approver {index + 1}</span>
                    <select name="approvalApproverUserId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={editableOffer.approvals?.[index]?.approver?.id || ''}>
                      <option value="">Optional</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>{member.user?.email || member.email || member.userId}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <button className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Request approval</button>
              </form>
            ) : null}

            {latestOffer?.status === 'APPROVED' ? (
              <form action={actions.releaseOfferAction.bind(null, application.applicationId, latestOffer.id)} className="space-y-3 rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">Release offer</p>
                <input name="expiryAt" type="datetime-local" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                <button className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Release to candidate</button>
              </form>
            ) : null}

            {releasedOffer ? (
              <form action={actions.createOfferRevisionAction.bind(null, application.applicationId, releasedOffer.id)} className="space-y-3 rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">Create revision</p>
                <input type="hidden" name="currency" value={releasedOffer.currency || 'INR'} />
                <input type="hidden" name="annualCompensation" value={releasedOffer.annualCompensation ?? ''} />
                <input type="hidden" name="fixedCompensation" value={releasedOffer.fixedCompensation ?? ''} />
                <input type="hidden" name="variableCompensation" value={releasedOffer.variableCompensation ?? ''} />
                <input type="hidden" name="joiningBonus" value={releasedOffer.joiningBonus ?? ''} />
                <input type="hidden" name="retentionBonus" value={releasedOffer.retentionBonus ?? ''} />
                <input type="hidden" name="otherCompensation" value={releasedOffer.otherCompensation ?? ''} />
                <input type="hidden" name="workMode" value={releasedOffer.workMode || ''} />
                <input type="hidden" name="workLocation" value={releasedOffer.workLocation || ''} />
                <input type="hidden" name="reportingManagerName" value={releasedOffer.reportingManagerName || ''} />
                <input type="hidden" name="offerExpiryDays" value={releasedOffer.offerExpiryDays || 7} />
                <input type="hidden" name="benefitsSummary" value={releasedOffer.benefitsSummary || ''} />
                <input type="hidden" name="compensationNotes" value={releasedOffer.compensationNotes || ''} />
                <input type="hidden" name="noticeOrBuyoutNote" value={releasedOffer.noticeOrBuyoutNote || ''} />
                <input type="hidden" name="termsAndConditions" value={releasedOffer.termsAndConditions || ''} />
                <input type="hidden" name="internalNotes" value={releasedOffer.internalNotes || ''} />
                <textarea name="revisionReason" className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Why is a revision needed?" required />
                <button className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Create revised version</button>
              </form>
            ) : null}

            {latestOffer && !['WITHDRAWN', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'JOINED', 'NO_SHOW'].includes(latestOffer.status) ? (
              <form action={actions.withdrawOfferAction.bind(null, application.applicationId, latestOffer.id)} className="space-y-3 rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">Withdraw offer</p>
                <input name="reason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Reason for withdrawal" required />
                <button className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Withdraw current offer</button>
              </form>
            ) : null}
          </div>
        </div>
      </Card>

      {latestOffer?.approvals?.length ? (
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Approval progress</h3>
          <div className="mt-4 space-y-3">
            {latestOffer.approvals.map((approval) => (
              <div key={approval.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Step {approval.sequence}</p>
                    <p className="text-[var(--muted)]">{approval.approver?.email || 'Approver'}</p>
                  </div>
                  <Badge tone={statusTone(approval.status)}>{approval.status.replaceAll('_', ' ')}</Badge>
                </div>
                <p className="mt-2 text-[var(--muted)]">Acted: {formatDate(approval.actedAt)}</p>
                <form action={actions.actOnOfferApprovalAction.bind(null, application.applicationId, latestOffer.id, approval.id, 'APPROVED')} className="mt-3 flex flex-wrap gap-3">
                  <input name="comments" className="min-w-64 flex-1 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Optional approval comment" />
                  <button className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Approve</button>
                </form>
                <form action={actions.actOnOfferApprovalAction.bind(null, application.applicationId, latestOffer.id, approval.id, 'CHANGES_REQUESTED')} className="mt-3 flex flex-wrap gap-3">
                  <input name="comments" className="min-w-64 flex-1 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Request changes" />
                  <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Request changes</button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {offers.length ? (
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Version history</h3>
          <div className="mt-4 space-y-3">
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{offer.referenceNumber}</p>
                    <p className="text-[var(--muted)]">Version {offer.version} | {offer.status.replaceAll('_', ' ')}</p>
                  </div>
                  <Badge tone={statusTone(offer.status)}>{offer.status.replaceAll('_', ' ')}</Badge>
                </div>
                <p className="mt-2 text-[var(--muted)]">Total: {formatMoney(offer.totalCompensation, offer.currency)} | Joining: {formatDate(offer.proposedJoiningDate)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {latestOffer?.status === 'ACCEPTED' || latestOffer?.status === 'JOINING_CONFIRMED' || latestOffer?.status === 'DEFERRED' ? (
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Joining lifecycle</h3>
          <form action={actions.updateOfferJoiningAction.bind(null, application.applicationId, latestOffer.id)} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <select name="status" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="JOINING_CONFIRMED">
                <option value="JOINING_CONFIRMED">Joining confirmed</option>
                <option value="DEFERRED">Deferred</option>
                <option value="JOINED">Joined</option>
                <option value="NO_SHOW">No show</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Actual joining date</span>
              <input name="actualJoiningDate" type="datetime-local" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Updated proposed joining date</span>
              <input name="proposedJoiningDate" type="datetime-local" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium">Reason</span>
              <textarea name="reason" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Reason for deferred or no-show outcomes." />
            </label>
            <button className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white md:col-span-2">Update joining status</button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
