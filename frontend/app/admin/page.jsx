import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { adminNav } from '@/lib/navigation';
import { PageHeader } from '@/components/ui/page-header';

const metrics = [
  { label: 'Total users', value: '12.4K', helper: 'Candidates, recruiters, and admins' },
  { label: 'AI generations', value: '89K', helper: 'Resume, ATS, cover letter, and coaching prompts' },
  { label: 'Monthly revenue', value: '$48.2K', helper: 'Subscriptions and premium exports' },
  { label: 'Conversion rate', value: '7.8%', helper: 'Free to paid upgrade rate' },
];

const modules = [
  'User management and role-based access control',
  'Template library management and content operations',
  'Subscription and monetization reporting',
  'AI usage monitoring, prompt control, and limits',
  'System configuration, audit visibility, and analytics',
];

export default function AdminPage() {
  return (
    <WorkspaceShell brand="Admin Control" items={adminNav}>
      <PageHeader
        eyebrow="Admin portal"
        title="Operate Careeriz from one control center"
        description="This admin workspace covers user management, subscriptions, content, AI monitoring, analytics, and system settings."
        breadcrumb={[{ label: 'Admin' }, { label: 'Overview' }]}
      />
        <Card className="bg-[linear-gradient(135deg,#102418_0%,#173c28_58%,#1e5a38_100%)] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-200">AI-Powered Talent Intelligence Platform</p>
          <h2 className="mt-3 text-3xl font-semibold">Enterprise oversight, AI usage visibility, and platform controls</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/76 md:text-base">
            Use this workspace to manage the platform side of Careeriz without exposing admin functionality elsewhere.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <StatCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Operations modules</h2>
            <div className="mt-5 space-y-3">
              {modules.map((module) => (
                <div key={module} className="rounded-2xl border border-[var(--line)] px-4 py-4 text-sm text-[var(--muted)]">
                  {module}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Revenue and usage snapshot</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[22px] bg-[var(--soft)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Professional plan</p>
                <p className="mt-2 text-2xl font-semibold">4,280 active</p>
              </div>
              <div className="rounded-[22px] bg-[var(--soft)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Premium plan</p>
                <p className="mt-2 text-2xl font-semibold">1,140 active</p>
              </div>
              <div className="rounded-[22px] bg-[var(--soft)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Avg AI cost per user</p>
                <p className="mt-2 text-2xl font-semibold">$1.82</p>
              </div>
            </div>
          </Card>
        </div>
    </WorkspaceShell>
  );
}
