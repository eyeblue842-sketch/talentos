import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getAssignedInterviewMeetings } from '@/lib/api';

function InterviewCard({ meeting }) {
  const round = meeting.interviewRound;
  const application = round?.interviewProcess?.application;
  const candidate = application?.candidate;
  const job = application?.job;
  const requiredParticipants = (meeting.participants || []).filter((participant) => participant.required);

  return (
    <Card className="rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">{round?.roundName || 'Interview'}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{candidate?.fullName || candidate?.user?.email || 'Candidate'} | {job?.title || 'Role'}</p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{meeting.status}</span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
        <p>Date: {meeting.scheduledStartUtc ? new Date(meeting.scheduledStartUtc).toLocaleString() : 'Not scheduled'}</p>
        <p>Timezone: {meeting.timezone || 'UTC'}</p>
        <p>Mode: {meeting.mode || 'Not set'}</p>
        <p>Provider: {meeting.providerDisplayName || meeting.provider || 'Not set'}</p>
        <p>Required participants: {requiredParticipants.length}</p>
        <p>Reminders: {(meeting.reminders || []).filter((item) => item.status === 'SCHEDULED').length}</p>
      </div>

      <div className="mt-4 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--text)]">Participants</p>
        <p className="mt-1">{(meeting.participants || []).map((participant) => `${participant.email} (${participant.participantRole})`).join(', ') || 'No participants attached.'}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {meeting.safeJoinUrl ? <a href={meeting.safeJoinUrl} className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Join meeting</a> : null}
        {round?.id ? <a href={`/api/interviews/rounds/${round.id}/calendar.ics`} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Download ICS</a> : null}
        {application?.id ? <Link href={`/recruiter/ats/${application.id}`} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Open ATS application</Link> : null}
      </div>
    </Card>
  );
}

export default async function RecruiterInterviewsPage() {
  const meetings = await getAssignedInterviewMeetings();
  const now = new Date();
  const upcoming = (meetings || []).filter((meeting) => meeting.scheduledStartUtc && new Date(meeting.scheduledStartUtc) >= now && meeting.status !== 'CANCELLED');
  const cancelled = (meetings || []).filter((meeting) => meeting.status === 'CANCELLED');

  return (
    <WorkspaceShell brand="Careeriz Hire" items={recruiterNav}>
      <PageHeader
        eyebrow="Assigned interviews"
        title="Track interviews in your local timezone"
        description="Use the live meeting schedule to review upcoming rounds, participant coverage, reminders, and join actions."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Interviews' }]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Upcoming</h2>
          {upcoming.length ? upcoming.map((meeting) => <InterviewCard key={meeting.id} meeting={meeting} />) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No upcoming assigned interviews.</Card>}
        </section>
        <section className="space-y-4">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Cancelled</h2>
          {cancelled.length ? cancelled.map((meeting) => <InterviewCard key={meeting.id} meeting={meeting} />) : <Card className="rounded-[28px] p-6 text-sm text-[var(--muted)]">No cancelled assigned interviews.</Card>}
        </section>
      </div>
    </WorkspaceShell>
  );
}
