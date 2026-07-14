import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, FileCheck2, FilePenLine, FileUser, LayoutDashboard, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { FeatureCard } from '@/components/sections/feature-card';

const builderFeatures = [
  'Create ATS-friendly resumes with live preview and template switching.',
  'Use AI prompts to improve summary, work impact, skills, and achievements.',
  'Export professional career documents and maintain versioned drafts.',
];

const careerFeatures = [
  'Generate cover letters, analyze job descriptions, and tailor resumes instantly.',
  'Track applications, interview stages, and follow-up notes in one dashboard.',
  'Give admins visibility into subscriptions, usage, revenue, and templates.',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
      <header className="mb-10 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-4 backdrop-blur md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">CareerCraft AI</p>
            <h1 className="mt-2 max-w-2xl font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-6xl">
              AI-powered resume, cover letter, ATS, and career platform.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">
              A standalone SaaS application for job seekers, hiring teams, and admins to build career documents, optimize for ATS, track opportunities, and manage subscriptions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth" className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-[var(--brand-strong)]">
              Launch platform <ArrowRight size={16} />
            </Link>
            <Link href="/resume-builder" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
              Open resume builder
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[32px] border border-[var(--line)] bg-white p-7 shadow-[0_20px_60px_rgba(16,36,24,0.08)]">
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--brand)]">
            <Sparkles size={16} /> Product modules
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FeatureCard icon={FilePenLine} title="Resume and document studio" items={builderFeatures} />
            <FeatureCard icon={FileUser} title="Career growth workspace" items={careerFeatures} />
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[28px] border border-[var(--line)] bg-[#0f2618] p-6 text-white shadow-[0_20px_60px_rgba(15,38,24,0.22)]">
            <LayoutDashboard className="mb-4" />
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Modular architecture</h2>
            <p className="mt-3 text-sm leading-6 text-white/76">
              Next.js frontend, Node backend, PostgreSQL-ready data design, and room for AI prompts, payments, exports, and analytics.
            </p>
          </div>
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--soft)] p-6">
            <Users className="mb-4 text-[var(--brand)]" />
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Built for three product roles</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Dedicated experiences for job seekers, hiring operations, and admins keep the platform organized while sharing the same product foundation.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {[
          {
            icon: FileCheck2,
            title: 'ATS Score Checker',
            body: 'Measure formatting, keyword coverage, skills, and readability to improve resume compatibility.',
            href: '/candidate/tools',
            label: 'Open AI tools',
          },
          {
            icon: BriefcaseBusiness,
            title: 'Career Dashboard',
            body: 'Track applications, suggested jobs, completion progress, and document activity in one place.',
            href: '/candidate',
            label: 'Open dashboard',
          },
          {
            icon: ShieldCheck,
            title: 'Admin Workspace',
            body: 'Monitor user growth, AI usage, subscriptions, template performance, and revenue operations.',
            href: '/admin',
            label: 'Open admin',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
              <Icon className="text-[var(--brand)]" size={20} />
              <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
              <Link href={item.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
                {item.label} <ArrowRight size={16} />
              </Link>
            </div>
          );
        })}
      </section>
    </main>
  );
}

