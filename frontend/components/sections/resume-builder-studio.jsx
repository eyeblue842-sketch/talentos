"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, BriefcaseBusiness, Download, FilePenLine, Link2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

const templates = [
  { id: 'executive', label: 'Executive' },
  { id: 'modern', label: 'Modern' },
  { id: 'classic', label: 'Classic' },
];

const starterExperience = [
  {
    company: 'CareerCraft AI',
    role: 'Frontend Developer',
    duration: '2024 - Present',
    impact: 'Built recruiter and candidate workflows that improved product delivery speed and produced ATS-friendly candidate experiences.',
  },
  {
    company: 'ScaleGrid',
    role: 'Software Engineer',
    duration: '2022 - 2024',
    impact: 'Developed customer-facing product features across React and Node.js systems with strong focus on performance and maintainability.',
  },
];

function buildInitialState(initialContext) {
  const candidateName = initialContext?.candidateName || 'Aarav Sharma';
  const candidateEmail = initialContext?.candidateEmail || 'aarav@example.com';
  const jobTitle = initialContext?.jobTitle || 'Full Stack Developer';
  const company = initialContext?.company || 'CareerCraft AI';

  return {
    fullName: candidateName,
    email: candidateEmail,
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    title: jobTitle,
    summary:
      'Product-minded full stack developer with strong experience building scalable web applications, polished UI flows, and ATS-friendly hiring products.',
    skills: 'React, Next.js, TypeScript, Node.js, PostgreSQL, Tailwind CSS, REST APIs, ATS Workflows',
    projects:
      'CareerCraft AI Resume Studio - Designed ATS-friendly resume workflows, live preview, and career document optimization experiences.',
    company,
    source: initialContext?.source || 'careercraft',
  };
}

function PreviewSection({ label, children }) {
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">{label}</p>
      <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{children}</div>
    </div>
  );
}

export function ResumeBuilderStudio({ initialContext, compact = false }) {
  const [template, setTemplate] = useState('modern');
  const [form, setForm] = useState(() => buildInitialState(initialContext));
  const [statusMessage, setStatusMessage] = useState('Autosave-ready demo');

  const skillList = useMemo(
    () => form.skills.split(',').map((item) => item.trim()).filter(Boolean),
    [form.skills],
  );

  const atsScore = useMemo(() => {
    let score = 62;

    if (form.summary.trim().length > 80) score += 10;
    if (skillList.length >= 6) score += 10;
    if (form.projects.trim().length > 40) score += 8;
    if (form.title.trim()) score += 5;
    if (starterExperience.length >= 2) score += 5;

    return Math.min(score, 96);
  }, [form.projects, form.summary, form.title, skillList.length]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatusMessage('Changes ready to save');
  }

  function handleSave() {
    setStatusMessage('Resume draft saved locally for demo');
  }

  function handleDownload() {
    setStatusMessage('PDF export can be connected next');
  }

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';

    try {
      await navigator.clipboard.writeText(url);
      setStatusMessage('Share link copied');
    } catch {
      setStatusMessage('Share link unavailable in this browser');
    }
  }

  return (
    <div className={`grid gap-6 ${compact ? 'xl:grid-cols-[0.92fr_1.08fr]' : 'xl:grid-cols-[0.9fr_1.1fr]'}`}>
      <section className="space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,#0f2618_0%,#19452a_60%,#285c39_100%)] text-white">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
              <Sparkles size={14} />
              Resume builder application
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2">
              <Link2 size={14} />
              Source: {form.company}
            </span>
          </div>
          <h1 className="mt-5 font-[var(--font-display)] text-4xl font-semibold tracking-tight">
            Build a professional resume in one workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/76 md:text-base">
            A standalone resume builder application where candidates can edit profile data, improve ATS strength, and preview the final resume live.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">ATS score: {atsScore}/100</span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">Template: {template}</span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2">{statusMessage}</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Candidate profile</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Resume details</h2>
            </div>
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Resume studio
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} placeholder="Full name" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Professional title" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Email" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="Phone" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="Location" />
            <textarea className="min-h-28 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="Professional summary" />
            <textarea className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" value={form.skills} onChange={(event) => updateField('skills', event.target.value)} placeholder="Skills separated by commas" />
            <textarea className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" value={form.projects} onChange={(event) => updateField('projects', event.target.value)} placeholder="Projects and achievements" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">
              <BadgeCheck size={16} />
              Save resume
            </button>
            <button type="button" onClick={handleDownload} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">
              <Download size={16} />
              Download PDF
            </button>
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">
              <Link2 size={16} />
              Share link
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <BriefcaseBusiness className="text-[var(--brand)]" size={18} />
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">ATS optimizer</p>
              <h2 className="mt-1 font-[var(--font-display)] text-2xl font-semibold">Template and quality guidance</h2>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {templates.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTemplate(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${template === item.id ? 'bg-[var(--brand)] text-white' : 'bg-[var(--soft)] text-[var(--brand)]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Formatting</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">Strong</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Clean structure, scannable sections, and recruiter-friendly headings.</p>
            </div>
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Keywords</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">Good</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Role title and key stack are already included for ATS matching.</p>
            </div>
            <div className="rounded-[22px] bg-[var(--soft)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Impact</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">Improve</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Add measurable outcomes and numbers to raise the final score further.</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-6">
        <Card className="bg-[#fffefb]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Live preview</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{form.fullName}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{form.title} | {form.location}</p>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--brand)]">
              {template} template
            </div>
          </div>

          <PreviewSection label="Contact">
            <p>{form.email}</p>
            <p>{form.phone}</p>
          </PreviewSection>

          <PreviewSection label="Professional Summary">
            <p>{form.summary}</p>
          </PreviewSection>

          <PreviewSection label="Core Skills">
            <div className="flex flex-wrap gap-2">
              {skillList.map((skill) => (
                <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-2 text-xs font-semibold text-[var(--brand)]">
                  {skill}
                </span>
              ))}
            </div>
          </PreviewSection>

          <PreviewSection label="Experience">
            <div className="space-y-4">
              {starterExperience.map((item) => (
                <div key={`${item.company}-${item.role}`}>
                  <p className="font-semibold text-[var(--text)]">{item.role} at {item.company}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{item.duration}</p>
                  <p className="mt-2">{item.impact}</p>
                </div>
              ))}
            </div>
          </PreviewSection>

          <PreviewSection label="Projects">
            <p>{form.projects}</p>
          </PreviewSection>
        </Card>

        <Card>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Platform workflow</p>
          <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">Use this builder as part of the full CareerCraft AI application</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-[var(--muted)]">
            <p>Keep `/resume-builder` as the public product demo for resume creation.</p>
            <p>Optional query params can prefill candidate name, email, and target role context.</p>
            <p>This screen can connect next to auth, autosave, template management, and export APIs.</p>
          </div>
          {!compact ? (
            <div className="mt-5">
              <Link href="/auth/candidate/login" className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
                <FilePenLine size={16} />
                Open auth flow
              </Link>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
