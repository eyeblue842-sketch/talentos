import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const stages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];
const decisionOptions = ['MOVE_NEXT_ROUND', 'REJECT', 'HOLD', 'CANCEL', 'COMPLETE', 'READY_FOR_OFFER'];

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString();
}

function formatList(value = []) {
  return value.length ? value.join(', ') : 'Not shared';
}

function formatLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

function scoreAverage(feedbacks = []) {
  if (!feedbacks.length) return null;
  const values = feedbacks.map((item) => Number(item.overallScore || 0)).filter(Boolean);
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function buildInterviewRounds(application) {
  return (application?.interviewProcesses || []).flatMap((process) =>
    (process.rounds || []).map((round) => ({ ...round, processId: process.id, processTitle: process.title }))
  );
}

export function RecruiterApplicationDetailView({
  application,
  members = [],
  actions,
}) {
  const safeActions = {
    addInterviewRoundAction: actions?.addInterviewRoundAction || (async () => {}),
    addNoteAction: actions?.addNoteAction || (async () => {}),
    cancelInterviewAction: actions?.cancelInterviewAction || (async () => {}),
    createInterviewPlanAction: actions?.createInterviewPlanAction || (async () => {}),
    decideInterviewRoundAction: actions?.decideInterviewRoundAction || (async () => {}),
    deleteNoteAction: actions?.deleteNoteAction || (async () => {}),
    duplicateInterviewRoundAction: actions?.duplicateInterviewRoundAction || (async () => {}),
    editNoteAction: actions?.editNoteAction || (async () => {}),
    moveApplicationStageAction: actions?.moveApplicationStageAction || (async () => {}),
    scheduleInterviewAction: actions?.scheduleInterviewAction || (async () => {}),
    submitInterviewFeedbackAction: actions?.submitInterviewFeedbackAction || (async () => {}),
  };
  const legacyApplicationId = application?.applicationId || application?.id;
  const interviewProcesses = application?.interviewProcesses || [];
  const interviewRounds = buildInterviewRounds(application);
  const primaryRound = interviewRounds[0] || null;

  return (
    <div className="space-y-6">
      <Card className="bg-[var(--surface)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl font-semibold">{application.candidate.fullName}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{application.candidate.headline || 'Candidate profile'} • {application.job.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Submitted {new Date(application.submittedAt).toLocaleString()} • Reference {application.publicReference}</p>
          </div>
          <Badge tone="brand">{application.stage}</Badge>
        </div>
        <form action={safeActions.moveApplicationStageAction.bind(null, legacyApplicationId)} className="mt-5 flex flex-wrap gap-3">
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
            <p><span className="font-semibold">Skills:</span> {formatList(application.candidate.skills)}</p>
            <p><span className="font-semibold">Experience:</span> {application.candidate.totalExperience ?? 'Not shared'} years</p>
            <p><span className="font-semibold">Location:</span> {application.candidate.location || 'Not shared'}</p>
            <p><span className="font-semibold">Availability:</span> {application.candidate.availability || 'Not shared'}</p>
            <p><span className="font-semibold">Email:</span> {application.candidate.email || 'Not shared'}</p>
            <p><span className="font-semibold">Source:</span> {application.source?.sourceName || application.source?.sourceType || 'Unknown'}</p>
            <p><span className="font-semibold">Job:</span> {application.job.title}</p>
            <p><span className="font-semibold">Resume snapshot:</span> {application.resume ? <a className="text-[var(--brand)]" href={application.resume.downloadUrl}>Download submitted resume</a> : 'No submitted resume snapshot'}</p>
            <p><span className="font-semibold">Candidate resume:</span> {application.candidate.resumeDownloadUrl ? <a className="text-[var(--brand)]" href={application.candidate.resumeDownloadUrl}>Download current candidate resume</a> : 'No candidate resume on file'}</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview plan</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Create the initial interview plan once, then schedule, duplicate, repeat, and progress each round from the ATS application workspace.</p>
          {!interviewProcesses.length ? (
            <form action={safeActions.createInterviewPlanAction.bind(null, legacyApplicationId)} className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Plan title</span>
                <input name="title" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="Default interview plan" required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">First round name</span>
                <input name="roundName" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Technical round" required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Sequence</span>
                <input name="sequence" type="number" min="1" max="50" defaultValue="1" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Round type</span>
                <select name="interviewType" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="TECHNICAL">
                  <option value="SCREENING">Screening</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DIRECTOR">Director</option>
                  <option value="HR">HR</option>
                  <option value="BEHAVIORAL">Behavioral</option>
                  <option value="CLIENT">Client</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Duration (minutes)</span>
                <input name="durationMinutes" type="number" min="15" max="480" defaultValue="60" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Round owner</span>
                <select name="ownerUserId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>{member.user?.email || member.email || member.userId}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Recruiter instructions</span>
                <textarea name="instructions" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="What this round should cover." />
              </label>
              <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white md:col-span-2">Create interview plan</button>
            </form>
          ) : (
            <div className="mt-5 space-y-3">
              {interviewProcesses.map((process) => (
                <div key={process.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{process.title}</p>
                      <p className="text-sm text-[var(--muted)]">{process.rounds?.length || 0} rounds configured</p>
                    </div>
                    <Badge tone="neutral">{process.status}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(process.rounds || []).map((round) => (
                      <div key={round.id} className="rounded-2xl bg-[var(--soft)] p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{round.sequence}. {round.roundName}</p>
                            <p className="text-[var(--muted)]">{formatLabel(round.interviewType)} • {round.status}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a href={`/api/interviews/rounds/${round.id}/calendar.ics`} className="rounded-full border border-[var(--line)] px-3 py-1.5 font-semibold">ICS</a>
                            <form action={safeActions.duplicateInterviewRoundAction.bind(null, legacyApplicationId, round.id)}>
                              <button className="rounded-full border border-[var(--line)] px-3 py-1.5 font-semibold">Repeat round</button>
                            </form>
                          </div>
                        </div>
                        <p className="mt-2 text-[var(--muted)]">Owner: {round.owner?.email || 'Unassigned'} • Duration: {round.durationMinutes || 'Not set'} minutes</p>
                        <p className="mt-1 text-[var(--muted)]">Panel: {(round.panelMembers || []).map((member) => member.user?.email || member.userId).join(', ') || 'Not assigned'}</p>
                      </div>
                    ))}
                  </div>
                  <form action={safeActions.addInterviewRoundAction.bind(null, legacyApplicationId, process.id)} className="mt-4 grid gap-3 md:grid-cols-4">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Round name</span>
                      <input name="roundName" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" placeholder="Add round name" required />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Sequence</span>
                      <input name="sequence" type="number" min="1" max="50" defaultValue={(process.rounds?.length || 0) + 1} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" required />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Round type</span>
                      <select name="interviewType" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" defaultValue="TECHNICAL">
                        <option value="SCREENING">Screening</option>
                        <option value="TECHNICAL">Technical</option>
                        <option value="MANAGER">Manager</option>
                        <option value="DIRECTOR">Director</option>
                        <option value="HR">HR</option>
                        <option value="BEHAVIORAL">Behavioral</option>
                        <option value="CLIENT">Client</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </label>
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Add round</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview scheduling</h2>
          {primaryRound ? (
            <>
              <p className="mt-2 text-sm text-[var(--muted)]">Schedule, reschedule, or cancel the active round while keeping candidate instructions, meeting mode, and panel assignment attached to the ATS timeline.</p>
              <form action={safeActions.scheduleInterviewAction.bind(null, legacyApplicationId)} className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Interview round</span>
                  <select name="roundId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={primaryRound.id}>
                    {interviewRounds.map((round) => (
                      <option key={round.id} value={round.id}>{round.sequence}. {round.roundName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Round type</span>
                  <select name="interviewType" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={primaryRound.interviewType || 'TECHNICAL'}>
                    <option value="SCREENING">Screening</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="MANAGER">Manager</option>
                    <option value="DIRECTOR">Director</option>
                    <option value="HR">HR</option>
                    <option value="BEHAVIORAL">Behavioral</option>
                    <option value="CLIENT">Client</option>
                    <option value="CUSTOM">Custom</option>
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
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Timezone</span>
                  <input name="timezone" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={primaryRound.timezone || 'Asia/Kolkata'} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Meeting mode</span>
                  <select name="meetingMode" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={primaryRound.meetingMode || 'VIRTUAL'}>
                    <option value="VIRTUAL">Virtual</option>
                    <option value="ONSITE">Onsite</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="PHONE">Phone</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Duration (minutes)</span>
                  <input name="durationMinutes" type="number" min="15" max="480" defaultValue={primaryRound.durationMinutes || 60} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Panel members</span>
                  <input name="panelUserIds" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Comma separated user IDs" defaultValue={(primaryRound.panelMembers || []).map((member) => member.userId).join(', ')} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Meeting location</span>
                  <input name="meetingLocation" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting location" defaultValue={primaryRound.meetingLocation || ''} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Meeting link</span>
                  <input name="meetingLink" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting link" defaultValue={primaryRound.meetingLink || ''} />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Office address</span>
                  <input name="officeAddress" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Office address" defaultValue={primaryRound.officeAddress || ''} />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Candidate instructions</span>
                  <textarea name="candidateInstructions" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Share the meeting prep, location, and joining notes." defaultValue={primaryRound.candidateInstructions || ''} />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Internal scheduler notes</span>
                  <textarea name="notes" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Visible in recruiter workflow only." defaultValue={primaryRound.instructions || ''} />
                </label>
                <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white md:col-span-2">Schedule or reschedule round</button>
              </form>

              <form action={safeActions.cancelInterviewAction.bind(null, legacyApplicationId)} className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Cancel interview round</span>
                  <select name="roundId" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={primaryRound.id}>
                    {interviewRounds.map((round) => (
                      <option key={round.id} value={round.id}>{round.sequence}. {round.roundName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Cancellation reason</span>
                  <input name="cancelReason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Explain why this round was cancelled" />
                </label>
                <button className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Cancel interview</button>
              </form>
            </>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">Create an interview plan first to unlock scheduling.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Hiring decision</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Capture the round outcome, progress the candidate to the next round, or mark the application ready for the next hiring state without leaving ATS.</p>
          {primaryRound ? (
            <form action={safeActions.decideInterviewRoundAction.bind(null, legacyApplicationId, primaryRound.id)} className="mt-5 space-y-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Decision</span>
                <select name="decision" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="MOVE_NEXT_ROUND">
                  {decisionOptions.map((decision) => (
                    <option key={decision} value={decision}>{formatLabel(decision)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Reason</span>
                <textarea name="reason" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Summarize the decision for the ATS timeline and audit trail." />
              </label>
              <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Apply decision</button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No interview round is available for decisions yet.</p>
          )}

          <div className="mt-6 space-y-3">
            {interviewRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{round.roundName}</p>
                  <Badge tone={round.status === 'COMPLETED' ? 'success' : round.status === 'CANCELLED' ? 'warning' : 'neutral'}>{round.status}</Badge>
                </div>
                <p className="mt-2 text-[var(--muted)]">{formatDateTime(round.scheduledStartAt)}</p>
                <p className="mt-1 text-[var(--muted)]">Decision: {round.decision ? formatLabel(round.decision) : 'Pending'}</p>
                <p className="mt-1 text-[var(--muted)]">Reschedules: {round.rescheduleCount || 0}</p>
              </div>
            ))}
            {!interviewRounds.length ? <p className="text-sm text-[var(--muted)]">No round decisions are available yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview feedback</h2>
          {primaryRound ? (
            <form action={safeActions.submitInterviewFeedbackAction.bind(null, legacyApplicationId, primaryRound.id)} className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Recommendation</span>
                <select name="recommendation" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="HIRE">
                  <option value="STRONG_HIRE">Strong hire</option>
                  <option value="HIRE">Hire</option>
                  <option value="HOLD">Hold</option>
                  <option value="NO_HIRE">No hire</option>
                  <option value="STRONG_NO_HIRE">Strong no hire</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Overall score</span>
                <input name="overallScore" type="number" min="0" max="100" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Technical</span>
                <input name="technicalRating" type="number" min="0" max="5" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Communication</span>
                <input name="communicationRating" type="number" min="0" max="5" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Problem solving</span>
                <input name="problemSolvingRating" type="number" min="0" max="5" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Culture fit</span>
                <input name="cultureFitRating" type="number" min="0" max="5" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Strengths</span>
                <textarea name="strengths" className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Weaknesses</span>
                <textarea name="weaknesses" className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Detailed notes</span>
                <textarea name="detailedNotes" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block font-medium">Summary comment</span>
                <textarea name="comments" className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
              </label>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button name="finalize" value="false" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Save draft</button>
                <button name="finalize" value="true" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Submit feedback</button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">Feedback becomes available after the first interview round is created.</p>
          )}

          <div className="mt-6 space-y-3">
            {interviewRounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{round.roundName}</p>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Avg score {scoreAverage(round.feedbacks) ?? 'N/A'}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(round.feedbacks || []).map((feedback) => (
                    <div key={feedback.id} className="rounded-2xl bg-[var(--soft)] p-3">
                      <p className="font-semibold">{feedback.interviewer?.email || 'Interviewer'}</p>
                      <p className="mt-1 text-[var(--muted)]">{feedback.recommendation ? formatLabel(feedback.recommendation) : 'Draft'} • Score {feedback.overallScore ?? 'N/A'}</p>
                      <p className="mt-2">{feedback.comments || feedback.detailedNotes || 'No written summary yet.'}</p>
                    </div>
                  ))}
                  {!round.feedbacks?.length ? <p className="text-[var(--muted)]">No feedback captured for this round yet.</p> : null}
                </div>
              </div>
            ))}
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
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{round.roundName}</p>
                  <Badge tone={round.status === 'COMPLETED' ? 'success' : round.status === 'CANCELLED' ? 'warning' : 'neutral'}>{round.status}</Badge>
                </div>
                <p className="mt-1 text-[var(--muted)]">{formatLabel(round.interviewType)} • {formatDateTime(round.scheduledStartAt)}</p>
                <p className="mt-1 text-[var(--muted)]">Panel: {(round.panelMembers || []).map((member) => member.user?.email || member.userId).join(', ') || 'Not assigned'}</p>
                <p className="mt-1 text-[var(--muted)]">Decision: {round.decision ? formatLabel(round.decision) : 'Pending'}</p>
                {round.candidateInstructions ? <p className="mt-2">{round.candidateInstructions}</p> : null}
              </div>
            ))}
            {!interviewRounds.length ? <p className="text-sm text-[var(--muted)]">No interview rounds are linked to this application yet.</p> : null}
          </div>
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
          <form action={safeActions.addNoteAction.bind(null, legacyApplicationId)} className="mt-5 space-y-3">
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
                <form action={safeActions.editNoteAction.bind(null, legacyApplicationId, note.id)} className="mt-3 space-y-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Edit recruiter note</span>
                    <textarea name="content" defaultValue={note.content} className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-3 py-2" />
                  </label>
                  <div className="flex gap-2">
                    <button className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Edit note</button>
                    <button formAction={safeActions.deleteNoteAction.bind(null, legacyApplicationId, note.id)} className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Delete note</button>
                  </div>
                </form>
              </div>
            ))}
            {!application.notes?.length ? <p className="text-sm text-[var(--muted)]">No recruiter notes yet.</p> : null}
          </div>
        </Card>

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
      </div>
    </div>
  );
}
