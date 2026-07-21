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
        title="Manage resumes and external builder access"
        description="Upload resumes for applications, choose a primary version, and open the standalone Resume Builder through a safe integration boundary."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Resumes' }]}
      />
      <CandidateResumeCenter resumes={resumes} resumeBuilderState={resumeBuilderState} />
    </WorkspaceShell>
  );
}
