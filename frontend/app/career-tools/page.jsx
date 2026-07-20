import Link from 'next/link';
import { FileText, SearchCheck, Sparkles } from 'lucide-react';
import { PublicHeader } from '@/components/public/public-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const tools = [
  {
    title: 'AI Job Matching',
    description: 'Understand which opportunities fit your background before you apply.',
    icon: SearchCheck,
  },
  {
    title: 'Resume Intelligence',
    description: 'Improve clarity, ATS compatibility and readiness for verified roles.',
    icon: FileText,
  },
  {
    title: 'Application Tracking',
    description: 'Keep applications, interviews and next steps organized in one workspace.',
    icon: Sparkles,
  },
];

export default function CareerToolsPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-md)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Career Tools</p>
          <h1 className="mt-4 max-w-2xl font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            AI support for every stage of the candidate journey.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            Careeriz brings job search, resume intelligence, and application visibility into one candidate-friendly experience.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button as="a" href="/auth/candidate/register">
              Create profile
            </Button>
            <Button as="a" href="/jobs" variant="outline">
              Search jobs
            </Button>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.title} variant="interactive" className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-[var(--color-text)]">{tool.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{tool.description}</p>
              </Card>
            );
          })}
        </section>
      </main>
    </>
  );
}
