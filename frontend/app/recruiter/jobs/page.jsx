import { Sidebar } from '@/components/layout/sidebar';
import { JobsTable } from '@/components/sections/jobs-table';
import { Card } from '@/components/ui/card';
import { recruiterNav } from '@/lib/mock-data';
import { getApprovedRequisitions, getOrganisationMembers, getRecruiterJobsPage } from '@/lib/api';
import { createJobAction } from '../actions';

function EmptyState() {
  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-xl font-semibold">No jobs yet</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Create the first organisation job to start collecting applicants and moving candidates through the ATS.</p>
    </Card>
  );
}

function ErrorState({ message }) {
  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-xl font-semibold">Jobs unavailable</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
    </Card>
  );
}

export default async function RecruiterJobsPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', params.page);

  let jobsResult = { items: [], meta: null };
  let members = [];
  let requisitions = [];
  let error = '';

  try {
    [jobsResult, members, requisitions] = await Promise.all([
      getRecruiterJobsPage(query.toString()),
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
        <Card className="bg-[var(--surface)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-semibold">Job management</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Create, publish, hold, close, and archive organisation jobs with requisition linkage and ATS visibility.</p>
            </div>
            {params?.notice ? <p className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[var(--brand)]">{params.notice}</p> : null}
          </div>
          <form className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input name="search" defaultValue={params?.search || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Search jobs by title" />
            <select name="status" defaultValue={params?.status || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="ON_HOLD">On hold</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <button className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Apply filters</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Create job</h2>
          <form action={createJobAction} className="mt-5 grid gap-3 md:grid-cols-2">
            <input name="title" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Job title" required />
            <input name="location" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Location" required />
            <input name="skillsRequired" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Skills, comma separated" required />
            <select name="employmentType" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="FULL_TIME">
              <option value="FULL_TIME">Full time</option>
              <option value="PART_TIME">Part time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </select>
            <select name="workplaceType" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
              <option value="">Workplace type</option>
              <option value="ONSITE">Onsite</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
            </select>
            <select name="recruiterId" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
              <option value="">Recruiter owner</option>
              {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
            </select>
            <select name="hiringManagerId" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
              <option value="">Hiring manager</option>
              {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
            </select>
            <select name="requisitionId" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
              <option value="">Approved requisition</option>
              {requisitions.map((requisition) => <option key={requisition.id} value={requisition.id}>{requisition.requisitionCode} - {requisition.title}</option>)}
            </select>
            <input name="experienceMin" type="number" min="0" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Min experience" required />
            <input name="experienceMax" type="number" min="0" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Max experience" required />
            <input name="salaryMin" type="number" min="0" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Min salary" />
            <input name="salaryMax" type="number" min="0" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Max salary" />
            <input name="currency" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Currency, e.g. INR" />
            <input name="numberOfOpenings" type="number" min="1" defaultValue="1" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Openings" />
            <input name="department" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Department" />
            <input name="businessUnit" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Business unit" />
            <input name="applicationDeadline" type="datetime-local" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
            <select name="status" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On hold</option>
            </select>
            <textarea name="description" className="md:col-span-2 min-h-36 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Job description" required />
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Create job</button>
          </form>
        </Card>

        {error ? <ErrorState message={error} /> : null}
        {!error && jobsResult.items.length === 0 ? <EmptyState /> : null}
        {!error && jobsResult.items.length > 0 ? <JobsTable jobs={jobsResult.items} /> : null}
      </section>
    </main>
  );
}
