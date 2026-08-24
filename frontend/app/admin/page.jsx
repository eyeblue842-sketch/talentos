import { BriefcaseBusiness } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminOverview } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminPage() {
  const [overviewSettled, currentUser] = await Promise.all([
    getAdminOverview().then(
      (value) => ({ value, error: '' }),
      (caught) => ({ value: null, error: caught.message })
    ),
    getCurrentUser(),
  ]);
  const overview = overviewSettled.value;
  const error = overviewSettled.error;

  // RECRUITER_ADMIN owns the recruiter application - the admin console is an
  // additional surface for it, not its primary workspace, so it needs a way
  // back. Plain ADMIN/PLATFORM_ADMIN accounts have no recruiter workspace to
  // return to.
  const isRecruiterOwner = currentUser?.role === 'RECRUITER_ADMIN';

  return (
    <WorkspaceShell brand={overview?.organisation?.name || 'Enterprise Admin'} items={adminNav} sidebarCollapsible>
      <PageHeader
        eyebrow="Enterprise administration"
        title="Operate the organization platform from one workspace"
        description="Manage organization configuration, roles, users, workflows, audit visibility, feature flags, and hiring analytics on top of the existing Careeriz platform."
        breadcrumb={[{ label: 'Admin' }, { label: 'Overview' }]}
        secondaryActions={isRecruiterOwner ? [{ label: 'Recruiter Workspace', href: '/recruiter/home', icon: BriefcaseBusiness }] : []}
      />

      {error ? (
        <Alert tone="danger" title="Overview unavailable">
          {error}
        </Alert>
      ) : null}

      {overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active members" value={overview.metrics.activeMembers} helper={`${overview.metrics.pendingInvitations} pending invitations`} />
            <StatCard label="Active jobs" value={overview.metrics.activeJobs} helper={`${overview.metrics.applications} applications`} />
            <StatCard label="Interviews and offers" value={`${overview.metrics.interviews} / ${overview.metrics.offers}`} helper="Live interview and offer volume" />
            <StatCard label="Flags and roles" value={`${overview.metrics.featureFlags} / ${overview.metrics.customRoles}`} helper={`${overview.metrics.structureNodes} structure nodes`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Organization snapshot</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div><span className="font-semibold">Name:</span> {overview.organisation?.name}</div>
                <div><span className="font-semibold">Slug:</span> {overview.organisation?.slug}</div>
                <div><span className="font-semibold">Status:</span> {overview.organisation?.status}</div>
                <div><span className="font-semibold">Industry:</span> {overview.organisation?.industry || 'Not set'}</div>
                <div><span className="font-semibold">Headquarters:</span> {overview.organisation?.headquarters || 'Not set'}</div>
              </div>
            </Card>

            <Card>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Permission snapshot</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {(overview.permissions || []).map((permission) => (
                  <span key={permission} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{permission}</span>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Operational links</h2>
              <div className="mt-5 grid gap-3 text-sm">
                {adminNav.slice(1).map((item) => (
                  <a key={item.href} href={item.href} className="rounded-2xl border border-[var(--line)] px-4 py-3 transition hover:border-[var(--brand)]">
                    {item.label}
                  </a>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Settings baseline</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div><span className="font-semibold">Timezone:</span> {overview.settings?.timezone || 'Not set'}</div>
                <div><span className="font-semibold">Currency:</span> {overview.settings?.currency || 'Not set'}</div>
                <div><span className="font-semibold">Language:</span> {overview.settings?.language || 'Not set'}</div>
                <div><span className="font-semibold">Date format:</span> {overview.settings?.dateFormat || 'Not set'}</div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </WorkspaceShell>
  );
}
