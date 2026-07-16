import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getCandidateDetail, searchCandidates } from '@/lib/api';

function ErrorState({ message }) {
  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-xl font-semibold">Search unavailable</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-xl font-semibold">No candidates found</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Search cards now return only minimal authorised fields. Refine the keyword or save a candidate to unlock deeper detail access.</p>
    </Card>
  );
}

export default async function RecruiterDatabasePage({ searchParams }) {
  const params = await searchParams;
  const keyword = params?.keyword || '';
  const candidateId = params?.candidateId || '';

  let candidates = [];
  let selectedCandidate = null;
  let errorMessage = '';

  try {
    candidates = await searchCandidates(keyword);
    if (candidateId) {
      selectedCandidate = await getCandidateDetail(candidateId);
    }
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Candidate database</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Organisation-scoped access policy: detail is available only when the candidate applied to this organisation or was explicitly saved by your team.</p>
          <form className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              name="keyword"
              defaultValue={keyword}
              className="rounded-2xl border border-[var(--line)] px-4 py-3"
              placeholder="Search by name, skill, or headline"
            />
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Search</button>
          </form>
        </Card>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}

        {!errorMessage && candidates.length === 0 ? <EmptyState /> : null}

        {!errorMessage && candidates.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {candidates.map((candidate) => (
                <Card key={candidate.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-[var(--font-display)] text-xl font-semibold">{candidate.fullName}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">{candidate.headline || 'Candidate profile'} • {candidate.location || 'Location not shared'}</p>
                    </div>
                    <Badge tone="brand">{candidate.totalExperience} yrs</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">{skill}</span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)]">Availability: {candidate.availability}</p>
                  <a
                    href={`/recruiter/database?keyword=${encodeURIComponent(keyword)}&candidateId=${candidate.id}`}
                    className="mt-5 inline-flex rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                  >
                    View authorised detail
                  </a>
                </Card>
              ))}
            </div>

            <Card>
              <h2 className="font-[var(--font-display)] text-xl font-semibold">Authorised candidate detail</h2>
              {!selectedCandidate ? (
                <p className="mt-3 text-sm text-[var(--muted)]">Select a candidate card to request organisation-authorised detail.</p>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <p><span className="font-semibold">Access reason:</span> {selectedCandidate.accessReason}</p>
                  <p><span className="font-semibold">Email:</span> {selectedCandidate.user?.email || 'Not available'}</p>
                  <p><span className="font-semibold">Summary:</span> {selectedCandidate.summary || 'No summary provided'}</p>
                  <p><span className="font-semibold">Resume URL:</span> {selectedCandidate.resumeUrl || 'No private resume uploaded'}</p>
                  <p><span className="font-semibold">Skills:</span> {selectedCandidate.skills.join(', ')}</p>
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}
