import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getCandidateInterviews } from '@/lib/api';
import { requestInterviewRescheduleAction, withdrawInterviewRescheduleAction } from '@/app/candidate/actions';

function renderInterviewCard(item) {
  const latestRequest = item.rescheduleRequests?.[0] || null;
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
        <p>Provider: {item.providerDisplayName || item.meetingProvider || 'Not shared'}</p>
        <p>Reschedules: {item.rescheduleCount || 0}</p>
        {item.dialInInformation ? <p className="md:col-span-2">Dial-in: {item.dialInInformation}</p> : null}
      </div>
      {item.candidateInstructions ? <p className="mt-4 text-sm text-[var(--muted)]">{item.candidateInstructions}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {item.meetingLink ? <a href={item.meetingLink} className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Open meeting link</a> : null}
        {item.calendarDownloadUrl ? <a href={item.calendarDownloadUrl} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Download calendar</a> : null}
        {item.applicationId ? <Link href={`/candidate/applications/${item.applicationId}`} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">View application</Link> : null}
      </div>
      {latestRequest ? (
        <div className="mt-5 rounded-2xl border border-[var(--line)] p-4 text-sm">
          <p className="font-semibold">Latest reschedule request: {latestRequest.status}</p>
          <p className="mt-1 text-[var(--muted)]">{latestRequest.reasonText || latestRequest.reasonCode || 'No reason shared.'}</p>
          {latestRequest.status === 'PENDING' ? (
            <form action={withdrawInterviewRescheduleAction} className="mt-3">
              <input type="hidden" name="requestId" value={latestRequest.id} />
              <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Withdraw request</button>
            </form>
          ) : null}
        </div>
      ) : null}
      {item.status === 'SCHEDULED' ? (
        <form action={requestInterviewRescheduleAction} className="mt-5 grid gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm md:grid-cols-2">
          <input type="hidden" name="roundId" value={item.id} />
          <label>
            <span className="mb-1 block font-medium">Reason</span>
            <select name="reasonCode" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="SCHEDULE_CONFLICT">Schedule conflict</option>
              <option value="MEDICAL_EMERGENCY">Medical emergency</option>
              <option value="PERSONAL_EMERGENCY">Personal emergency</option>
              <option value="TECHNICAL_ISSUE">Technical issue</option>
              <option value="TRAVEL">Travel</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block font-medium">Preferred timezone</span>
            <input name="preferredTimezone" defaultValue={item.timezone || 'Asia/Kolkata'} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block font-medium">Reason details</span>
            <textarea name="reasonText" className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Share the scheduling constraint for the recruiter or coordinator." />
          </label>
          {[1, 2].map((slot) => (
            <div key={slot} className="grid gap-3 md:col-span-2 md:grid-cols-3">
              <label>
                <span className="mb-1 block font-medium">Preferred start {slot}</span>
                <input type="datetime-local" name={`preferredStart${slot}`} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label>
                <span className="mb-1 block font-medium">Preferred end {slot}</span>
                <input type="datetime-local" name={`preferredEnd${slot}`} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label>
                <span className="mb-1 block font-medium">Timezone {slot}</span>
                <input name={`preferredTimezone${slot}`} defaultValue={item.timezone || 'Asia/Kolkata'} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
            </div>
          ))}
          <button className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white md:col-span-2">Request reschedule</button>
        </form>
      ) : null}
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
