import { Filter, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { AiJobMatches } from '@/components/sections/ai-job-matches';
import { JobGrid } from '@/components/sections/job-grid';
import { Card } from '@/components/ui/card';
import { aiRecommendedJobs, candidateJobs, candidateNav, candidatePreferenceProfile } from '@/lib/mock-data';

export default function CandidateJobsPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="CareerCraft AI" items={candidateNav} />
      <section className="space-y-6">
        <Card className="rounded-[32px] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(16,36,24,0.08)] md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
                <Sparkles size={14} />
                Candidate discovery
              </div>
              <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight">Browse jobs</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)] md:text-base">
                Search manually, compare salary ranges, and review AI-ranked openings matched against candidate skills, preferred location, and expected CTC.
              </p>
            </div>
            <div className="grid gap-3 rounded-[24px] border border-[var(--line)] bg-white p-4 md:grid-cols-3 xl:w-[440px] xl:grid-cols-1">
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <SlidersHorizontal size={16} className="text-[var(--brand)]" />
                Advanced search controls
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <Sparkles size={16} className="text-[var(--brand)]" />
                AI matches stay separate
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <Filter size={16} className="text-[var(--brand)]" />
                Salary filtering in LPA
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_14px_40px_rgba(16,36,24,0.05)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              <Filter size={14} />
              Manual browse filters
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr_0.95fr]">
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Keyword or role title" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Preferred location" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Skills" />
              <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Search jobs</button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr]">
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Min salary (LPA)" />
              <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Max salary (LPA)" />
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
                Salary filters work independently from AI matches, so candidates can explore roles outside their recommendation envelope.
              </div>
            </div>
          </div>
        </Card>

        <AiJobMatches jobs={aiRecommendedJobs} preferenceProfile={candidatePreferenceProfile} />

        <Card className="rounded-[30px] bg-white p-6 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
                <Search size={14} />
                Manual Browse Results
              </div>
              <h2 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight">Explore the broader job market</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                These are standard browse results, separate from recommendation-based ranking, so candidates can compare AI-fit opportunities with the full opportunity set.
              </p>
            </div>
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
              5 roles visible after current filters
            </div>
          </div>
        </Card>

        <JobGrid jobs={candidateJobs} />
      </section>
    </main>
  );
}
