import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandidateApplicationWithdrawForm } from './candidate-application-withdraw-form';

const candidateStages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED'];

function formatDateTime(value) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
}

function formatStageLabel(value) {
  return String(value || 'APPLIED').replaceAll('_', ' ');
}

function getStageIndex(stage) {
  const index = candidateStages.indexOf(stage);
  return index === -1 ? 0 : index;
}

function getBadgeTone(stage) {
  if (stage === 'REJECTED') return 'danger';
  if (stage === 'SELECTED') return 'success';
  if (stage === 'INTERVIEW_SCHEDULED') return 'brand';
  return 'neutral';
}

function renderAnswerValue(answer) {
  if (Array.isArray(answer.answerValue)) return answer.answerValue.join(', ');
  if (answer.file?.filename) return answer.file.filename;
  if (answer.answerValue === true) return 'Yes';
  if (answer.answerValue === false) return 'No';
  return String(answer.answerValue ?? 'Not answered');
}

export function CandidateApplicationDetailView({ application }) {
  const stageIndex = getStageIndex(application.stage);
  const interviewRounds = (application.interviewProcesses || []).flatMap((process) => process.rounds || []);
  const upcomingRounds = interviewRounds.filter((round) => round.status === 'SCHEDULED' && round.scheduledStartAt && new Date(round.scheduledStartAt) >= new Date());
  const pastRounds = interviewRounds.filter((round) => round.status !== 'SCHEDULED' || (round.scheduledStartAt && new Date(round.scheduledStartAt) < new Date()));

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Application tracking</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{application.job?.title}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {application.job?.organisation?.name || 'Careeriz employer'} | Ref {application.publicReference}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Badge tone={getBadgeTone(application.stage)}>{application.status}</Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{formatStageLabel(application.stage)}</span>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 md:grid-cols-4" aria-label="Application stage progress">
          {candidateStages.map((stage, index) => (
            <li key={stage} className={`rounded-[24px] border px-4 py-4 ${index <= stageIndex ? 'border-[var(--brand)] bg-[var(--soft)]' : 'border-[var(--line)] bg-white'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Stage {index + 1}</p>
              <p className="mt-2 font-semibold">{formatStageLabel(stage)}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Application summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <p><span className="font-semibold">Submitted:</span> {formatDateTime(application.submittedAt)}</p>
            <p><span className="font-semibold">Location:</span> {application.job?.location || 'Not shared'}</p>
            <p><span className="font-semibold">Resume:</span> {application.resume?.filename || 'No resume snapshot available'}</p>
            <p><span className="font-semibold">Source:</span> {application.source?.sourceName || application.source?.sourceType || 'Unknown'}</p>
            <p><span className="font-semibold">Questions answered:</span> {application.screeningSummary?.answeredQuestions ?? application.answers?.length ?? 0}</p>
            <p><span className="font-semibold">Candidate updates:</span> {application.timeline?.length || 0}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/candidate/applications" className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Back to applications</Link>
            {application.job?.slug ? <Link href={`/jobs/${application.job.slug}`} className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">View job</Link> : null}
            <Link href="/candidate/jobs" className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Browse similar jobs</Link>
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Timeline</h2>
          <div className="mt-5 space-y-3">
            {application.timeline?.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{item.eventType.replaceAll('_', ' ')}</p>
                <p className="mt-2">{item.message}</p>
                <p className="mt-2 text-[var(--muted)]">{formatDateTime(item.createdAt)}</p>
              </div>
            ))}
            {!application.timeline?.length ? <p className="text-sm text-[var(--muted)]">No candidate-visible updates have been added yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Upcoming interviews</h2>
          <div className="mt-5 space-y-3">
            {upcomingRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{round.roundName}</p>
                <p className="mt-1 text-[var(--muted)]">{formatStageLabel(round.interviewType)} | {round.status}</p>
                <p className="mt-2"><span className="font-semibold">When:</span> {formatDateTime(round.scheduledStartAt)}</p>
                <p><span className="font-semibold">Mode:</span> {round.meetingMode ? formatStageLabel(round.meetingMode) : 'Not shared'}</p>
                <p><span className="font-semibold">Instructions:</span> {round.candidateInstructions || 'No special instructions shared yet.'}</p>
                <p><span className="font-semibold">Panel:</span> {(round.panelMembers || []).map((member) => member.user?.email || 'Panel member').join(', ') || 'To be announced'}</p>
                {round.meetingLink ? <a href={round.meetingLink} className="mt-3 inline-flex rounded-2xl bg-[var(--brand)] px-4 py-2 font-semibold text-white">Join meeting</a> : null}
              </div>
            ))}
            {!upcomingRounds.length ? <p className="text-sm text-[var(--muted)]">No upcoming interviews are scheduled yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview history</h2>
          <div className="mt-5 space-y-3">
            {pastRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{round.roundName}</p>
                <p className="mt-1 text-[var(--muted)]">{formatStageLabel(round.interviewType)} | {round.status}</p>
                <p className="mt-2"><span className="font-semibold">Scheduled:</span> {formatDateTime(round.scheduledStartAt)}</p>
                <p><span className="font-semibold">Reschedules:</span> {round.rescheduleCount || 0}</p>
                {round.cancelReason ? <p><span className="font-semibold">Cancellation reason:</span> {round.cancelReason}</p> : null}
                {round.decision ? <p><span className="font-semibold">Outcome:</span> {formatStageLabel(round.decision)}</p> : null}
              </div>
            ))}
            {!pastRounds.length ? <p className="text-sm text-[var(--muted)]">Past interview history will appear here after your first round is scheduled.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Screening answers</h2>
          <div className="mt-5 space-y-3">
            {application.answers?.map((answer) => (
              <div key={answer.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{answer.internalLabel || answer.questionText}</p>
                <p className="mt-1 text-[var(--muted)]">{answer.questionType} | {answer.required ? 'Required' : 'Optional'}</p>
                <p className="mt-3">{renderAnswerValue(answer)}</p>
              </div>
            ))}
            {!application.answers?.length ? <p className="text-sm text-[var(--muted)]">No screening responses were captured.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">What happens next</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <p>Your submitted resume and answers are locked to this application reference so later profile edits do not change the original submission.</p>
            <p>Status changes that recruiters mark as candidate-visible will appear in this timeline automatically.</p>
            <p>If an interview is scheduled, this application stage will move forward and the latest update will show here first.</p>
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Withdrawal</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Withdraw only if you no longer want to continue with this application.</p>
            <div className="mt-4">
              <CandidateApplicationWithdrawForm applicationId={application.id} canWithdraw={application.canWithdraw} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
