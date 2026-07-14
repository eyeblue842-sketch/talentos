import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { getCandidateDashboard } from '@/lib/api';
import { candidateApplications, candidateJobs, candidateNav } from '@/lib/mock-data';

export default async function CandidateDashboardPage() {
  const dashboard = await getCandidateDashboard();

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="CareerCraft AI" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Career dashboard</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Manage documents, applications, and AI career progress</h1>
          <p className="mt-2 text-[var(--muted)]">Track your resume strength, job activity, and next career actions in one workspace.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Jobs applied" value={dashboard.applicationsCount} helper="Across all active applications" />
          <StatCard label="Resume views" value={dashboard.resumeViews} helper="Recruiter profile discovery" />
          <StatCard label="Suggested jobs" value={candidateJobs.length} helper="Based on skill overlap" />
        </div>
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">Application pulse</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {candidateApplications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">{item.role}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.company}</p>
                <p className="mt-4 text-sm text-[var(--muted)]">{item.status}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-[var(--font-display)] text-xl font-semibold">CareerCraft AI module coverage</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              'Resume builder with live preview and ATS-focused editing',
              'AI tools for cover letters, tailoring, and job description analysis',
              'Job application tracking plus recommended opportunity discovery',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--line)] p-4 text-sm leading-7 text-[var(--muted)]">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

