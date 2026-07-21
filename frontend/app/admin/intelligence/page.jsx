import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getIntelligenceGovernance, getIntelligenceHealth } from '@/lib/api';
import { AdminIntelligenceGovernancePanel } from '@/components/sections/admin-intelligence-governance-panel';

export default async function AdminIntelligencePage() {
  let governance = null;
  let health = null;
  let error = '';

  try {
    [governance, health] = await Promise.all([
      getIntelligenceGovernance(),
      getIntelligenceHealth(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader
        eyebrow="Careeriz Intelligence"
        title="Govern intelligence usage and provider health"
        description="Review feature usage, failures, prompt versions, provider availability, and recent organization-scoped intelligence executions."
        breadcrumb={[{ label: 'Admin' }, { label: 'Intelligence' }]}
      />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {governance ? <AdminIntelligenceGovernancePanel governance={governance} health={health} /> : null}
    </WorkspaceShell>
  );
}
