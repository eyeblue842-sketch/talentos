import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getCandidateInterviews } from '@/lib/api';

function renderInterviewCard(item) {
  return (
    <Card key={item.id} className="rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">{item.roundName}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.job?.title || 'Interview'} | {item.job?.organisation?.name || 'Careeriz employer'}</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{item.status}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
        <p>Date: {item.scheduledStartAt ? new Date(item.scheduledStartAt).toLocaleString() : 'Not scheduled'}</p>
        <p>Timezone: {item.timezone || 'Not shared'}</p>
        <p>Mode: {item.meetingMode || 'Not shared'}</p>
        <p>Reschedules: {item.rescheduleCount || 0}</p>
      </div>
      {item.candidateInstructions ? <p className="mt-4 text-sm text-[var(--muted)]">{item.candidateInstructions}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {item.meetingLink ? <a href={item.meetingLink} className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Open meeting link</a> : null}
        {item.applicationId ? <Link href={`/candidate/applications/${item.applicationId}`} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">View application</Link> : null}
      </div>
    </Card>
  );
}

export default async function CandidateInterviewsPage() {
  const interviews = await getCandidateInterviews();

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Interview center"
        title="Track every scheduled interview in one place"
        description="Review upcoming, completed, cancelled, and rescheduled interviews using the live Milestone 3 interview data."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Interviews' }]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Upcoming interviews</h2>
          {interviews.upcoming.length ? interviews.upcoming.map(renderInterviewCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No upcoming interviews scheduled.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Rescheduled</h2>
          {interviews.rescheduled.length ? interviews.rescheduled.map(renderInterviewCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No rescheduled interviews yet.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Past interviews</h2>
          {interviews.past.length ? interviews.past.map(renderInterviewCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No completed interview history yet.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Cancelled interviews</h2>
          {interviews.cancelled.length ? interviews.cancelled.map(renderInterviewCard) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No cancelled interviews recorded.</Card>}
        </section>
      </div>
    </WorkspaceShell>
  );
}
