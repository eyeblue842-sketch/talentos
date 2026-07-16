import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getOrganisationMembers, getRecruiterApplication } from '@/lib/api';
import { addNoteAction, cancelInterviewAction, deleteNoteAction, editNoteAction, moveApplicationStageAction, scheduleInterviewAction } from '../../actions';

const stages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];

export default async function RecruiterApplicationDetailPage({ params }) {
  const { applicationId } = await params;

  let application = null;
  let members = [];
  let error = '';

  try {
    [application, members] = await Promise.all([
      getRecruiterApplication(applicationId),
      getOrganisationMembers(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Link href="/recruiter/ats" className="text-sm font-semibold text-[var(--brand)]">Back to ATS pipeline</Link>
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {application ? (
          <>
            <Card className="bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-[var(--font-display)] text-3xl font-semibold">{application.candidate.fullName}</h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">{application.candidate.headline || 'Candidate profile'} • {application.job.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Applied {new Date(application.appliedAt).toLocaleString()}</p>
                </div>
                <Badge tone="brand">{application.currentStage}</Badge>
              </div>
              <form action={moveApplicationStageAction.bind(null, application.id)} className="mt-5 flex flex-wrap gap-3">
                <select name="stage" defaultValue={application.currentStage} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                  {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
                <button className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold">Update stage</button>
              </form>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate and job summary</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <p><span className="font-semibold">Skills:</span> {application.candidate.skills.join(', ')}</p>
                  <p><span className="font-semibold">Experience:</span> {application.candidate.totalExperience} years</p>
                  <p><span className="font-semibold">Location:</span> {application.candidate.location || 'Not shared'}</p>
                  <p><span className="font-semibold">Availability:</span> {application.candidate.availability}</p>
                  <p><span className="font-semibold">Resume preview:</span> {application.candidate.resumeUrl || 'Private resume not available on this application'}</p>
                  <p><span className="font-semibold">Job status:</span> {application.job.status}</p>
                  <p><span className="font-semibold">Created:</span> {new Date(application.appliedAt).toLocaleString()}</p>
                  <p><span className="font-semibold">Updated:</span> {new Date(application.updatedAt).toLocaleString()}</p>
                </div>
              </Card>

              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Interview scheduling</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Uses the Phase 2 interview-round foundation and records notifications, audit events, and timeline activity.</p>
                <form action={scheduleInterviewAction.bind(null, application.id)} className="mt-5 grid gap-3 md:grid-cols-2">
                  <select name="roundId" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={application.interviewProcesses?.[0]?.rounds?.[0]?.id || ''}>
                    {application.interviewProcesses?.flatMap((process) => process.rounds || []).map((round) => (
                      <option key={round.id} value={round.id}>{round.roundName}</option>
                    ))}
                  </select>
                  <select name="interviewType" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="TECHNICAL">
                    <option value="SCREENING">Screening</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="MANAGERIAL">Managerial</option>
                    <option value="HR">HR</option>
                    <option value="PANEL">Panel</option>
                    <option value="TAKE_HOME">Take home</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input name="scheduledStartAt" type="datetime-local" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="scheduledEndAt" type="datetime-local" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="panelUserIds" className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Panel member user IDs, comma separated" defaultValue={members.map((member) => member.userId).join(',')} />
                  <input name="meetingLocation" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting location" />
                  <input name="meetingLink" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Meeting link" />
                  <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Schedule or reschedule</button>
                </form>

                <form action={cancelInterviewAction.bind(null, application.id)} className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
                  <select name="roundId" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue={application.interviewProcesses?.[0]?.rounds?.[0]?.id || ''}>
                    {application.interviewProcesses?.flatMap((process) => process.rounds || []).map((round) => (
                      <option key={round.id} value={round.id}>{round.roundName}</option>
                    ))}
                  </select>
                  <input name="cancelReason" className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Cancel reason" />
                  <button className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Cancel interview</button>
                </form>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recruiter notes</h2>
                <form action={addNoteAction.bind(null, application.id)} className="mt-5 space-y-3">
                  <textarea name="content" className="min-h-28 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Add an organisation-scoped note" required />
                  <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Add note</button>
                </form>
                <div className="mt-5 space-y-3">
                  {application.notes?.map((note) => (
                    <div key={note.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                      <p className="font-semibold">{note.author?.email || 'Unknown author'}</p>
                      <p className="mt-2">{note.content}</p>
                      <p className="mt-2 text-[var(--muted)]">{new Date(note.createdAt).toLocaleString()}</p>
                      <form action={editNoteAction.bind(null, application.id, note.id)} className="mt-3 space-y-2">
                        <textarea name="content" defaultValue={note.content} className="min-h-20 w-full rounded-2xl border border-[var(--line)] px-3 py-2" />
                        <div className="flex gap-2">
                          <button className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Edit note</button>
                          <button formAction={deleteNoteAction.bind(null, application.id, note.id)} className="rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Delete note</button>
                        </div>
                      </form>
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
                </div>

                <h3 className="mt-6 font-[var(--font-display)] text-xl font-semibold">Interview rounds</h3>
                <div className="mt-3 space-y-3">
                  {application.interviewProcesses?.flatMap((process) => process.rounds || []).map((round) => (
                    <div key={round.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm">
                      <p className="font-semibold">{round.roundName}</p>
                      <p className="text-[var(--muted)]">{round.interviewType} • {round.status}</p>
                      <p className="mt-1 text-[var(--muted)]">{round.scheduledStartAt ? new Date(round.scheduledStartAt).toLocaleString() : 'Not scheduled yet'}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
