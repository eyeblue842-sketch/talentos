import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getCandidateOffers } from '@/lib/api';

function offerCard(item) {
  return (
    <Card key={item.id} className="rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-[var(--font-display)] text-2xl font-semibold">{item.job?.title || 'Offer'}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.job?.organisation?.name || 'Careeriz employer'} | {item.referenceNumber}</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{item.status}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
        <p>Compensation: {item.currency} {Number(item.totalCompensation || 0).toLocaleString('en-IN')}</p>
        <p>Joining date: {item.proposedJoiningDate ? new Date(item.proposedJoiningDate).toLocaleDateString() : 'Not set'}</p>
        <p>Expiry: {item.expiryAt ? new Date(item.expiryAt).toLocaleString() : 'Not set'}</p>
        <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not available'}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/candidate/offers/${item.id}`} className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">View offer</Link>
        <a href={item.pdfDownloadUrl} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Download PDF</a>
      </div>
    </Card>
  );
}

export default async function CandidateOffersPage() {
  const offers = await getCandidateOffers();

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Offer center"
        title="Review offers and joining progress"
        description="Track active offers, responses, expiry, superseded history, and joining-status continuity from the Milestone 4 offer lifecycle."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Offers' }]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Active offers</h2>
          {offers.active.length ? offers.active.map(offerCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No active offers yet.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Accepted offers</h2>
          {offers.accepted.length ? offers.accepted.map(offerCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No accepted offers yet.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Expired or withdrawn</h2>
          {[...offers.expired, ...offers.withdrawn].length
            ? [...offers.expired, ...offers.withdrawn].map(offerCard)
            : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No expired or withdrawn offers recorded.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Superseded history</h2>
          {offers.superseded.length ? offers.superseded.map(offerCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No superseded offer versions yet.</Card>}
        </section>
      </div>
    </WorkspaceShell>
  );
}
