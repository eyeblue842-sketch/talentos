import { FileCheck2, FileText, ScanSearch, Sparkles, Target, WandSparkles } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { candidateNav } from '@/lib/mock-data';

const tools = [
  {
    icon: Sparkles,
    title: 'AI Resume Writer',
    body: 'Generate stronger summaries, rewrite experience bullets, and add quantified achievements for ATS readiness.',
    action: 'Generate summary',
  },
  {
    icon: FileCheck2,
    title: 'ATS Score Checker',
    body: 'Review formatting, keywords, measurable impact, education coverage, and skill alignment in one scan.',
    action: 'Run ATS scan',
  },
  {
    icon: Target,
    title: 'Resume Tailoring',
    body: 'Paste a job description and rewrite your document to match required skills and role-specific language.',
    action: 'Tailor resume',
  },
  {
    icon: ScanSearch,
    title: 'Job Description Analyzer',
    body: 'Extract responsibilities, must-have skills, and experience requirements from pasted job content.',
    action: 'Analyze JD',
  },
  {
    icon: FileText,
    title: 'Cover Letter Builder',
    body: 'Create a role-specific cover letter with opening, body, and closing sections ready to edit.',
    action: 'Draft letter',
  },
  {
    icon: WandSparkles,
    title: 'LinkedIn Optimizer',
    body: 'Refine headline, about section, and key accomplishments for better recruiter visibility.',
    action: 'Optimize profile',
  },
];

export default function CandidateToolsPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="CareerCraft AI" items={candidateNav} />
      <section className="space-y-6">
        <Card className="bg-[linear-gradient(135deg,#0f2618_0%,#19452a_60%,#285c39_100%)] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-200">AI career tools</p>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Every career document workflow in one toolkit</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/76 md:text-base">
            This workspace covers the core modules from the product brief: AI writing, ATS analysis, job description matching, cover letters, and resume tailoring.
          </p>
        </Card>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.title}>
                <Icon className="text-[var(--brand)]" size={20} />
                <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">{tool.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{tool.body}</p>
                <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--muted)]">
                  Demo module ready for backend prompt integration.
                </div>
                <button className="mt-5 rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">
                  {tool.action}
                </button>
              </Card>
            );
          })}
        </div>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Prompt-ready workflow</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Input</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Resume data, job description, career preferences, and role targets.</p>
            </div>
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">AI Layer</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">OpenAI-backed prompts for summaries, bullet rewriting, skill gaps, and match scoring.</p>
            </div>
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Output</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Optimized resume, tailored document variants, ATS feedback, and application-ready assets.</p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
