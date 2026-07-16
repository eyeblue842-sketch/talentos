import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getCandidateDetail } from '@/lib/api';
import { saveCandidateAction, unsaveCandidateAction } from '../../actions';

export default async function RecruiterCandidateDetailPage({ params }) {
  const { candidateId } = await params;

  let candidate = null;
  let error = '';
  try {
    candidate = await getCandidateDetail(candidateId);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Link href="/recruiter/database" className="text-sm font-semibold text-[var(--brand)]">Back to candidate search</Link>
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {candidate ? (
          <>
            <Card className="bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-[var(--font-display)] text-3xl font-semibold">{candidate.fullName}</h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">{candidate.headline || 'Candidate profile'} • {candidate.location || 'Location not shared'}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Access reason: {candidate.accessReason}</p>
                </div>
                <div className="flex gap-2">
                  {candidate.organisationTags?.map((tag) => <Badge key={tag} tone="brand">{tag}</Badge>)}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate profile</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <p><span className="font-semibold">Email:</span> {candidate.user?.email || 'Not available'}</p>
                  <p><span className="font-semibold">Experience:</span> {candidate.totalExperience} years</p>
                  <p><span className="font-semibold">Availability:</span> {candidate.availability}</p>
                  <p><span className="font-semibold">Summary:</span> {candidate.summary || 'No summary provided'}</p>
                  <p><span className="font-semibold">Skills:</span> {candidate.skills.join(', ')}</p>
                  <p><span className="font-semibold">Resume URL:</span> {candidate.resumeUrl || 'No private resume uploaded'}</p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <form action={saveCandidateAction.bind(null, candidate.id)} className="flex gap-2">
                    <select name="tag" defaultValue="" className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm">
                      <option value="">Save without tag</option>
                      <option value="SHORTLISTED">Shortlisted</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="HOLD">Hold</option>
                    </select>
                    <button className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Save candidate</button>
                  </form>
                  <form action={unsaveCandidateAction.bind(null, candidate.id)}>
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Remove saved</button>
                  </form>
                </div>
              </Card>

              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Organisation context</h2>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="font-semibold">Applications to current organisation</p>
                    {candidate.organisationApplications?.length ? (
                      <div className="mt-2 space-y-2 text-sm">
                        {candidate.organisationApplications.map((application) => (
                          <div key={application.id} className="rounded-2xl border border-[var(--line)] p-3">
                            <p className="font-semibold">{application.job.title}</p>
                            <p className="text-[var(--muted)]">{application.currentStage} • {new Date(application.appliedAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-sm text-[var(--muted)]">No organisation applications found.</p>}
                  </div>

                  <div>
                    <p className="font-semibold">Resume builder preview</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Projects: {Array.isArray(candidate.resumeBuilder?.projects) ? candidate.resumeBuilder.projects.length : 0} • Experience entries: {Array.isArray(candidate.resumeBuilder?.experience) ? candidate.resumeBuilder.experience.length : 0}</p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
