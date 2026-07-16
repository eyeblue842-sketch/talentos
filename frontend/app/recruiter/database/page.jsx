import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getSavedCandidates, searchCandidates } from '@/lib/api';
import { saveCandidateAction, unsaveCandidateAction } from '../actions';

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
      <p className="mt-2 text-sm text-[var(--muted)]">Use skills, experience, availability, and location filters to search the real organisation-authorised resume database.</p>
    </Card>
  );
}

export default async function RecruiterDatabasePage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['keyword', 'skill', 'location', 'minExperience', 'maxExperience', 'availability', 'fresher', 'tag', 'page']) {
    if (params?.[key]) query.set(key, params[key]);
  }

  let result = { items: [], meta: null };
  let saved = { items: [], meta: null };
  let errorMessage = '';

  try {
    [result, saved] = await Promise.all([
      searchCandidates(query.toString()),
      getSavedCandidates(params?.savedTag ? `tag=${encodeURIComponent(params.savedTag)}` : ''),
    ]);
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card className="bg-[var(--surface)]">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Resume database</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Search returns only minimal candidate-card data. Private detail remains gated behind organisation-authorised access rules.</p>
          <form className="mt-5 grid gap-3 md:grid-cols-3">
            <input name="keyword" defaultValue={params?.keyword || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Search keyword" />
            <input name="skill" defaultValue={params?.skill || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Specific skill" />
            <input name="location" defaultValue={params?.location || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Location" />
            <input name="minExperience" type="number" min="0" defaultValue={params?.minExperience || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Min experience" />
            <input name="maxExperience" type="number" min="0" defaultValue={params?.maxExperience || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Max experience" />
            <select name="availability" defaultValue={params?.availability || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="">Availability</option>
              <option value="IMMEDIATE">Immediate</option>
              <option value="TWO_WEEKS">Two weeks</option>
              <option value="ONE_MONTH">One month</option>
              <option value="NOT_LOOKING">Not looking</option>
            </select>
            <select name="fresher" defaultValue={params?.fresher || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="">Fresher or experienced</option>
              <option value="true">Fresher</option>
              <option value="false">Experienced</option>
            </select>
            <select name="tag" defaultValue={params?.tag || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="">Organisation tag</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="REJECTED">Rejected</option>
              <option value="HOLD">Hold</option>
            </select>
            <div className="flex gap-3">
              <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Search</button>
              <Link href="/recruiter/database" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Clear</Link>
            </div>
          </form>
        </Card>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {!errorMessage && result.items.length === 0 ? <EmptyState /> : null}

        {!errorMessage && result.items.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              {result.items.map((candidate) => (
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
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge tone={candidate.resumeAvailable ? 'success' : 'warning'}>{candidate.resumeAvailable ? 'Resume available' : 'Resume unavailable'}</Badge>
                    <Badge tone={candidate.savedByOrganisation ? 'brand' : 'neutral'}>{candidate.savedByOrganisation ? 'Saved by organisation' : 'Not saved'}</Badge>
                    {candidate.organisationTags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)]">Availability: {candidate.availability}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/recruiter/database/${candidate.id}`} className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Preview profile</Link>
                    {candidate.savedByOrganisation ? (
                      <form action={unsaveCandidateAction.bind(null, candidate.id)}>
                        <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Remove saved</button>
                      </form>
                    ) : (
                      <form action={saveCandidateAction.bind(null, candidate.id)} className="flex gap-2">
                        <select name="tag" defaultValue="" className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm">
                          <option value="">Save without tag</option>
                          <option value="SHORTLISTED">Shortlisted</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="HOLD">Hold</option>
                        </select>
                        <button className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Save candidate</button>
                      </form>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Card>
              <h2 className="font-[var(--font-display)] text-xl font-semibold">Saved candidates</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Organisation-scoped saved candidates and tags.</p>
              {saved.items.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--muted)]">No saved candidates yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {saved.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--line)] p-3">
                      <p className="font-semibold">{item.candidate.fullName}</p>
                      <p className="text-sm text-[var(--muted)]">{item.candidate.headline || 'Candidate profile'}</p>
                      <div className="mt-2 flex gap-2">
                        {item.tag ? <Badge tone="brand">{item.tag}</Badge> : <Badge tone="neutral">No tag</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}
