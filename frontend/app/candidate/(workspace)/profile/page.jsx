import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandidateProfileForm } from '@/components/sections/candidate-profile-form';
import { candidateNav } from '@/lib/navigation';
import { getCandidateProfile } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';

export default async function CandidateProfilePage() {
  const { profile, completion } = await getCandidateProfile();

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Candidate profile"
          title="Keep your profile current"
          breadcrumb={[{ label: 'Candidate' }, { label: 'Profile' }]}
        />
          <Badge tone="brand">{completion.percentage}% complete</Badge>
      </div>
      <Card className="rounded-[32px] p-6">
        <CandidateProfileForm profile={profile} />
      </Card>
    </WorkspaceShell>
  );
}
