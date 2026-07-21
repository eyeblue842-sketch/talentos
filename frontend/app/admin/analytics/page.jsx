import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminAnalytics } from '@/lib/api';
import { AnalyticsInsightPanel } from '@/components/sections/analytics-insight-panel';

export default async function AdminAnalyticsPage() {
  let analytics = null;
  let error = '';
  try {
    analytics = await getAdminAnalytics();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Enterprise analytics" title="Review organization hiring metrics" description="All metrics on this page come from persisted jobs, applications, interviews, offers, and organization membership data." breadcrumb={[{ label: 'Admin' }, { label: 'Analytics' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {analytics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active jobs" value={analytics.metrics.activeJobs} helper={`${analytics.metrics.applications} total applications`} />
            <StatCard label="Interviews" value={analytics.metrics.interviews} helper={`${analytics.metrics.offers} offers`} />
            <StatCard label="Joiners" value={analytics.metrics.joining} helper={`${analytics.metrics.offerAcceptanceRate}% offer acceptance`} />
            <StatCard label="Recruiter performance base" value={analytics.metrics.recruiterPerformanceCount} helper="Active hiring members in organization scope" />
          </div>
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Pipeline funnel</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(analytics.pipelineFunnel || []).map((item) => (
                <div key={item.stage} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                  <p className="font-semibold">{item.stage}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.count}</p>
                </div>
              ))}
            </div>
          </Card>
          <AnalyticsInsightPanel />
        </>
      ) : null}
    </WorkspaceShell>
  );
}
