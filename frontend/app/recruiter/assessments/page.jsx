import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AssessmentTemplatesManager } from '@/components/recruiter/assessment-templates-manager';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterAssessmentTemplates } from '@/lib/api';

export default async function RecruiterAssessmentsPage() {
  let organisation = null;
  let templates = [];
  let error = '';
  try {
    [organisation, templates] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterAssessmentTemplates(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Assessment Forms"
        description="Editable interview scorecards. Pick one when scheduling an interview — the interviewer fills it in as their assessment."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Assessment Forms' }]}
      />
      {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}
      <AssessmentTemplatesManager initialTemplates={templates} />
    </WorkspaceShell>
  );
}
