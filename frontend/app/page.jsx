import { ArrowRight, BrainCircuit, FileCheck2, GitPullRequestArrow, Radar } from 'lucide-react';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { redirectIfAuthenticated } from '@/lib/auth';
import { redirectToSetupIfRequired } from '@/lib/setup';

const aiFeatures = [
  {
    title: 'Resume Intelligence',
    body: 'Improve candidate profiles and application quality.',
    icon: FileCheck2,
  },
  {
    title: 'Job Matching',
    body: 'Connect relevant roles and talent with stronger fit signals.',
    icon: Radar,
  },
  {
    title: 'Candidate Ranking',
    body: 'Prioritize recruiter review with structured scoring support.',
    icon: GitPullRequestArrow,
  },
  {
    title: 'Interview Assistance',
    body: 'Support preparation, coordination, and decision-making.',
    icon: BrainCircuit,
  },
];

const journeyCards = [
  {
    eyebrow: 'Careeriz Jobs',
    title: 'For candidates and professionals',
    body: 'Find relevant jobs, improve your resume with AI, prepare for interviews, and track your applications.',
    href: '/candidate',
    cta: 'Continue as Candidate',
    tone: 'candidate',
    bullets: [
      'Find relevant jobs',
      'Improve your resume with AI',
      'Prepare for interviews',
      'Track your applications',
    ],
  },
  {
    eyebrow: 'Careeriz Hire',
    title: 'For recruiters and employers',
    body: 'Publish and manage jobs, track candidates through the ATS, use AI candidate ranking, and coordinate interviews and hiring.',
    href: '/hire',
    cta: 'Continue as Employer',
    tone: 'employer',
    bullets: [
      'Publish and manage jobs',
      'Track candidates through the ATS',
      'Use AI candidate ranking',
      'Coordinate interviews and hiring',
    ],
  },
];

function FeatureCard({ feature }) {
  const Icon = feature.icon;

  return (
    <Card variant="interactive" className="group flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-[var(--color-text)]">{feature.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{feature.body}</p>
      </div>
    </Card>
  );
}

function JourneyCard({ item }) {
  const surface = item.tone === 'candidate'
    ? 'bg-[linear-gradient(180deg,#ffffff_0%,#f6f2ff_100%)]'
    : 'bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)]';

  const chip = item.tone === 'candidate'
    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
    : 'bg-[color:rgba(79,156,249,0.14)] text-[var(--color-info)]';

  return (
    <Card className={`flex h-full flex-col gap-5 p-6 md:p-7 ${surface}`}>
      <div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${chip}`}>
          {item.eyebrow}
        </span>
        <h2 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          {item.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
          {item.body}
        </p>
        <ul className="mt-5 grid gap-2 text-sm text-[var(--color-text-secondary)]">
          {item.bullets.map((bullet) => (
            <li key={bullet} className="rounded-[16px] border border-[var(--color-border)] bg-white/78 px-3 py-2">
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto">
        <Button as="a" href={item.href} size="lg" className="w-full justify-center">
          {item.cta}
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

export default async function HomePage() {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-screen max-w-[88rem] flex-col px-5 py-6 sm:px-6 lg:px-10">
        <section className="rounded-[32px] border border-[var(--color-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(241,236,255,0.96)_48%,rgba(235,245,255,0.92)_100%)] p-6 shadow-[var(--shadow-floating)] sm:p-8">
          <div className="max-w-3xl">
            <Badge variant="purple" className="px-4 py-1.5 text-[11px] uppercase tracking-[0.24em]">
              AI Talent Intelligence Platform
            </Badge>
            <h1 className="mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl xl:text-[3.65rem]">
              One intelligent platform for careers and hiring.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
              Choose the Careeriz experience built for your next step.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="grid gap-6 xl:grid-cols-2">
            {journeyCards.map((item) => (
              <JourneyCard key={item.eyebrow} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[28px] border border-[var(--color-border)] bg-white/88 p-6 shadow-[var(--shadow-md)]">
          <div className="max-w-3xl">
            <Badge variant="purple" className="px-4 py-1.5">Careeriz AI</Badge>
            <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
              Careeriz AI powers both sides of the talent journey.
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {aiFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
