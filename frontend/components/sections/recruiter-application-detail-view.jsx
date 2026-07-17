import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const stages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];

export function RecruiterApplicationDetailView({
  application,
  members = [],
  actions,
}) {
  const legacyApplicationId = application?.applicationId || application?.id;
  const interviewRounds = application?.interviewProcesses?.flatMap((process) => process.rounds || []) || [];

  return (
    <>
      <Card className="bg-[var(--surface)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl font-semibold">{application.candidate.fullName}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{application.candidate.headline || 'Candidate profile'} • {application.job.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Submitted {new Date(application.submittedAt).toLocaleString()} • Reference {application.publicReference}</p>
          </div>
          <Badge tone="brand">{application.stage}</Badge>
        </div>
        <form action={actions.moveApplicationStageAction.bind(null, legacyApplicationId)} className="mt-5 flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Application stage</span>
            <select name="stage" defaultValue={application.stage} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Update stage</button>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate and job summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <p><span className="font-semibold">Skills:</span> {application.candidate.skills?.join(', ') || 'Not shared'}</p>
            <p><span className="font-semibold">Experience:</span> {application.candidate.totalExperience ?? 'Not shared'} years</p>
            <p><span className="font-semibold">Location:</span> {application.candidate.location || 'Not shared'}</p>
            <p><span className="font-semibold">Availability:</span> {application.candidate.availability || 'Not shared'}</p>
            <p><span className="font-semibold">Email:</span> {application.candidate.email || 'Not shared'}</p>
            <p><span className="font-semibold">Resume snapshot:</span> {application.resume ? <a className="text-[var(--brand)]" href={application.resume.downloadUrl}>Download submitted resume</a> : 'No submitted resume snapshot'}</p>
            <p><span className="font-semibold">Candidate resume:</span> {application.candidate.resumeDownloadUrl ? <a className="text-[var(--brand)]" href={application.candidate.resumeDownloadUrl}>Download current candidate resume</a> : 'No candidate resume on file'}</p>
            <p><span className="font-semibold">Source:</span> {application.source?.sourceName || application.source?.sourceType || 'Unknown'}</p>
            <p><span className="font-semibold">Job:</span> {application.job.title}</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview scheduling</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Preserves the existing ATS interview scheduling and cancellation workflow while showing the new application snapshot data separately.</p>
          <form action={actions.scheduleInterviewAction.bind(null, legacyApplicationId)} className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Interview round</span>
              <select name="roundId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={interviewRounds[0]?.id || ''}>
                {interviewRounds.map((round) => (
                  <option key={round.id} value={round.id}>{round.roundName}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Interview type</span>
              <select name="interviewType" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="TECHNICAL">
                <option value="SCREENING">Screening</option>
                <option value="TECHNICAL">Technical</option>
                <option value="MANAGERIAL">Managerial</option>
                <option value="HR">HR</option>
                <option value="PANEL">Panel</option>
                <option value="TAKE_HOME">Take home</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Scheduled start</span>
              <input name="scheduledStartAt" type="datetime-local" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Scheduled end</span>
              <input name="scheduledEndAt" type="datetime-local" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" required />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium">Panel members</span>
              <input name="panelUserIds" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Panel member user IDs, comma separated" defaultValue={members.map((member) => member.userId).join(',')} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Meeting location</span>
              <input name="meetingLocation" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting location" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Meeting link</span>
              <input name="meetingLink" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting link" />
            </label>
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Schedule or reschedule</button>
          </form>

          <form action={actions.cancelInterviewAction.bind(null, legacyApplicationId)} className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Cancel interview round</span>
              <select name="roundId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={interviewRounds[0]?.id || ''}>
                {interviewRounds.map((round) => (
                  <option key={round.id} value={round.id}>{round.roundName}</option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium">Cancel reason</span>
              <input name="cancelReason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Cancel reason" />
            </label>
            <button className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Cancel interview</button>
          </form>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Screening answers</h2>
          <div className="mt-5 space-y-3">
            {application.answers?.map((answer) => (
              <div key={answer.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{answer.questionText}</p>
                <p className="mt-1 text-[var(--muted)]">{answer.questionType} • {answer.required ? 'Required' : 'Optional'}</p>
                <p className="mt-2">
                  {Array.isArray(answer.answerValue)
                    ? answer.answerValue.join(', ')
                    : answer.file
                      ? answer.file.filename
                      : String(answer.answerValue ?? 'Not answered')}
                </p>
                {answer.file ? <a className="mt-2 inline-flex font-semibold text-[var(--brand)]" href={answer.file.downloadUrl}>Download attachment</a> : null}
                {answer.screeningOutcome ? <p className="mt-2 text-[var(--muted)]">Outcome: {answer.screeningOutcome}</p> : null}
              </div>
            ))}
            {!application.answers?.length ? <p className="text-sm text-[var(--muted)]">No screening answers were submitted.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Screening flags and summary</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[var(--line)] p-3 text-sm">
              <p className="font-semibold">Summary</p>
              <p className="mt-2 text-[var(--muted)]">Flags: {application.screeningSummary?.flags || 0} • Questions: {application.screeningSummary?.totalQuestions || application.answers?.length || 0}</p>
            </div>
            {application.flags?.map((flag) => (
              <div key={flag.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{flag.outcome}</p>
                <p className="mt-1 text-[var(--muted)]">{flag.internalReason}</p>
              </div>
            ))}
            {!application.flags?.length ? <p className="text-sm text-[var(--muted)]">No screening flags were generated.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recruiter notes</h2>
          <form action={actions.addNoteAction.bind(null, legacyApplicationId)} className="mt-5 space-y-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">New recruiter note</span>
              <textarea name="content" className="min-h-28 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Add an organisation-scoped note" required />
            </label>
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Add note</button>
          </form>
          <div className="mt-5 space-y-3">
            {application.notes?.map((note) => (
              <div key={note.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{note.author?.email || 'Unknown author'}</p>
                <p className="mt-2">{note.content}</p>
                <p className="mt-2 text-[var(--muted)]">{new Date(note.createdAt).toLocaleString()}</p>
                <form action={actions.editNoteAction.bind(null, legacyApplicationId, note.id)} className="mt-3 space-y-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Edit recruiter note</span>
                    <textarea name="content" defaultValue={note.content} className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-3 py-2" />
                  </label>
                  <div className="flex gap-2">
                    <button className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Edit note</button>
                    <button formAction={actions.deleteNoteAction.bind(null, legacyApplicationId, note.id)} className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Delete note</button>
                  </div>
                </form>
              </div>
            ))}
            {!application.notes?.length ? <p className="text-sm text-[var(--muted)]">No recruiter notes yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Activity timeline</h2>
          <div className="mt-5 space-y-3">
            {application.activities?.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{activity.eventType || 'ACTIVITY'}</p>
                <p className="mt-1">{activity.message}</p>
                <p className="mt-1 text-[var(--muted)]">{activity.actor?.email || 'System'} • {new Date(activity.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!application.activities?.length ? <p className="text-sm text-[var(--muted)]">No recruiter activity yet.</p> : null}
          </div>

          <h3 className="mt-6 font-[var(--font-display)] text-xl font-semibold">Interview rounds</h3>
          <div className="mt-3 space-y-3">
            {interviewRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold">{round.roundName}</p>
                <p className="text-[var(--muted)]">{round.interviewType} • {round.status}</p>
                <p className="mt-1 text-[var(--muted)]">{round.scheduledStartAt ? new Date(round.scheduledStartAt).toLocaleString() : 'Not scheduled yet'}</p>
                <p className="mt-1 text-[var(--muted)]">Feedbacks: {round.feedbacks?.length || 0}</p>
              </div>
            ))}
            {!interviewRounds.length ? <p className="text-sm text-[var(--muted)]">No interview rounds are linked to this application yet.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Submission timeline and metadata</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Application reference</p>
            <p className="mt-2 text-[var(--muted)]">{application.publicReference}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Submitted at</p>
            <p className="mt-2 text-[var(--muted)]">{new Date(application.submittedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {application.timeline?.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
              <p className="font-semibold">{item.eventType}</p>
              <p className="mt-1">{item.message}</p>
              <p className="mt-1 text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {!application.timeline?.length ? <p className="text-sm text-[var(--muted)]">No submission timeline items available.</p> : null}
        </div>
      </Card>
    </>
  );
}
