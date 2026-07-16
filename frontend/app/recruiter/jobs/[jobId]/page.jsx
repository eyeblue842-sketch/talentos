import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getApprovedRequisitions, getOrganisationMembers, getRecruiterJob } from '@/lib/api';
import { deleteJobAction, updateJobAction, updateJobStatusAction } from '../../actions';

function statusTone(status) {
  if (status === 'OPEN') return 'success';
  if (status === 'DRAFT' || status === 'ON_HOLD') return 'warning';
  if (status === 'ARCHIVED') return 'neutral';
  return 'danger';
}

export default async function RecruiterJobDetailPage({ params, searchParams }) {
  const { jobId } = await params;
  const query = await searchParams;

  let job = null;
  let members = [];
  let requisitions = [];
  let error = '';

  try {
    [job, members, requisitions] = await Promise.all([
      getRecruiterJob(jobId),
      getOrganisationMembers(),
      getApprovedRequisitions(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const assignees = members.filter((member) => ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(member.role));

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Link href="/recruiter/jobs" className="text-sm font-semibold text-[var(--brand)]">Back to jobs</Link>
        {query?.notice ? <p className="text-sm font-semibold text-[var(--brand)]">{query.notice}</p> : null}
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {job ? (
          <>
            <Card className="bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-[var(--font-display)] text-3xl font-semibold">{job.title}</h1>
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{job.location} • {job.employmentType} {job.workplaceType ? `• ${job.workplaceType}` : ''}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Applicants: {job.applicationsCount || 0} • Requisition: {job.requisition?.requisitionCode || 'None'}</p>
                </div>
                <div className="flex gap-2">
                  <form action={updateJobStatusAction.bind(null, job.id)}>
                    <input type="hidden" name="status" value={job.status === 'OPEN' ? 'CLOSED' : 'OPEN'} />
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">
                      {job.status === 'OPEN' ? 'Close job' : 'Open job'}
                    </button>
                  </form>
                  <form action={updateJobStatusAction.bind(null, job.id)}>
                    <input type="hidden" name="status" value="ARCHIVED" />
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Archive</button>
                  </form>
                  <form action={deleteJobAction.bind(null, job.id)}>
                    <button className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete</button>
                  </form>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Edit job</h2>
                <form action={updateJobAction.bind(null, job.id)} className="mt-5 grid gap-3 md:grid-cols-2">
                  <input name="title" defaultValue={job.title} className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="location" defaultValue={job.location} className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="skillsRequired" defaultValue={job.skillsRequired.join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <select name="employmentType" defaultValue={job.employmentType} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="FULL_TIME">Full time</option>
                    <option value="PART_TIME">Part time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                  <select name="workplaceType" defaultValue={job.workplaceType || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="">Workplace type</option>
                    <option value="ONSITE">Onsite</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                  <select name="recruiterId" defaultValue={job.recruiter?.id || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="">Recruiter owner</option>
                    {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
                  </select>
                  <select name="hiringManagerId" defaultValue={job.hiringManager?.id || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="">Hiring manager</option>
                    {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
                  </select>
                  <select name="requisitionId" defaultValue={job.requisition?.id || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="">Approved requisition</option>
                    {requisitions.map((requisition) => <option key={requisition.id} value={requisition.id}>{requisition.requisitionCode} - {requisition.title}</option>)}
                  </select>
                  <input name="experienceMin" type="number" min="0" defaultValue={job.experienceMin} className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="experienceMax" type="number" min="0" defaultValue={job.experienceMax} className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <input name="salaryMin" type="number" min="0" defaultValue={job.salaryMin ?? ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="salaryMax" type="number" min="0" defaultValue={job.salaryMax ?? ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="currency" defaultValue={job.currency || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="numberOfOpenings" type="number" min="1" defaultValue={job.numberOfOpenings || 1} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="department" defaultValue={job.department || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="businessUnit" defaultValue={job.businessUnit || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <input name="applicationDeadline" type="datetime-local" defaultValue={job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().slice(0, 16) : ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" />
                  <select name="status" defaultValue={job.status} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                    <option value="DRAFT">Draft</option>
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                    <option value="ON_HOLD">On hold</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <textarea name="description" defaultValue={job.description} className="md:col-span-2 min-h-40 rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save changes</button>
                </form>
              </Card>

              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Job summary</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <p><span className="font-semibold">Recruiter owner:</span> {job.recruiter?.email || 'Unassigned'}</p>
                  <p><span className="font-semibold">Hiring manager:</span> {job.hiringManager?.email || 'Unassigned'}</p>
                  <p><span className="font-semibold">Department:</span> {job.department || 'Not set'}</p>
                  <p><span className="font-semibold">Business unit:</span> {job.businessUnit || 'Not set'}</p>
                  <p><span className="font-semibold">Openings:</span> {job.numberOfOpenings || 1}</p>
                  <p><span className="font-semibold">Deadline:</span> {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleString() : 'No deadline'}</p>
                  <p><span className="font-semibold">Pipeline summary:</span> {job.pipelineSummary?.map((item) => `${item.stage}: ${item.count}`).join(', ') || 'No applicants yet'}</p>
                </div>
                <Link href={`/recruiter/ats?jobId=${job.id}`} className="mt-6 inline-flex rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Open ATS pipeline</Link>
              </Card>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
