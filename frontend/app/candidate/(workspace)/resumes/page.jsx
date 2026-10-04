import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getCandidateResumeAssets, getResumeBuilderState } from '@/lib/api';
import { CandidateResumeCenter } from '@/components/sections/candidate-resume-center';

export default async function CandidateResumesPage() {
  const [resumes, resumeBuilderState] = await Promise.all([
    getCandidateResumeAssets(),
    getResumeBuilderState(),
  ]);

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Candidate resumes"
        title="Manage your resumes"
        description="Upload a resume for applications, choose a primary version, and let Careeriz parse it to fill your profile automatically."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Resumes' }]}
      />
      <CandidateResumeCenter resumes={resumes} resumeBuilderState={resumeBuilderState} />
    </WorkspaceShell>
  );
}
