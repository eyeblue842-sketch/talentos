import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { CandidateSettingsForm } from '@/components/sections/candidate-settings-form';
import { candidateNav } from '@/lib/navigation';
import { getCandidateSettings } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';

export default async function CandidateSettingsPage() {
  const { settings } = await getCandidateSettings();

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Candidate preferences"
        title="Control search preferences, privacy, and alerts"
        breadcrumb={[{ label: 'Candidate' }, { label: 'Settings' }]}
      />
      <Card className="rounded-[32px] p-6">
        <CandidateSettingsForm settings={settings} />
      </Card>
    </WorkspaceShell>
  );
}
