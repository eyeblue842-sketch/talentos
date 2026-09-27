import { JobCandidateRankingPanel } from '@/components/sections/job-candidate-ranking-panel';
import { RecruiterJobDetailView } from '@/components/sections/recruiter-job-detail-view';
import { LinkedInShareBox } from '@/components/recruiter/linkedin-share-box';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ScreeningQuestionBuilder } from '@/components/sections/screening-question-builder';
import { Tabs } from '@/components/ui/tabs';
import { recruiterNav } from '@/lib/navigation';
import {
  getCandidateRanking,
  getCandidateRankingStatus,
  getCurrentOrganisation,
  getOrganisationMembers,
  getRecruiterJob,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  addJobQuestionAction,
  deleteJobAction,
  deleteJobQuestionAction,
  duplicateJobQuestionAction,
  reorderJobQuestionsAction,
  updateJobAction,
  updateJobQuestionAction,
  updateJobStatusAction,
} from '../../actions';

export default async function RecruiterJobDetailPage({ params, searchParams }) {
  const { jobId } = await params;
  const query = await searchParams;

  let job = null;
  let organisation = null;
  let members = [];
  let currentUser = null;
  let error = '';
  let initialCandidateRanking = null;
  let initialCandidateRankingStatus = null;

  const candidateRankingEnabled = isFeatureEnabled('candidateRanking');

  try {
    [organisation, job, members, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJob(jobId),
      getOrganisationMembers(),
      getCurrentUser(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const assignees = members.filter((member) => ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(member.role));
  const canReadCandidateRanking = hasUserPermission(currentUser, 'intelligence.ranking.read');
  const canGenerateCandidateRanking = hasUserPermission(currentUser, 'intelligence.ranking.generate');

  if (job && candidateRankingEnabled && canReadCandidateRanking) {
    const [rankingResult, rankingStatus] = await Promise.all([
      getCandidateRanking(job.id).catch(() => null),
      getCandidateRankingStatus(job.id).catch(() => null),
    ]);
    initialCandidateRanking = rankingResult;
    initialCandidateRankingStatus = rankingStatus;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title={job?.title || 'Job detail'}
        description={job ? 'Review the job, edit its details, set screening questions, and rank applicants with AI.' : 'Recruiter job detail workspace.'}
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Jobs', href: '/recruiter/jobs' }, { label: job?.title || 'Detail' }]}
        secondaryActions={[{ label: 'Back to jobs', href: '/recruiter/jobs' }]}
      />
        {query?.notice ? <p className="text-sm font-semibold text-[var(--color-primary)]">{query.notice}</p> : null}
        {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}
        {job ? (
          <>
            <RecruiterJobDetailView
              job={job}
              assignees={assignees}
              updateJobAction={updateJobAction.bind(null, job.id)}
              closeReopenAction={updateJobStatusAction.bind(null, job.id)}
              archiveAction={updateJobStatusAction.bind(null, job.id)}
              deleteAction={deleteJobAction.bind(null, job.id)}
              atsHref={`/recruiter/ats?jobId=${job.id}`}
            />

            {job.status === 'OPEN' ? <LinkedInShareBox jobId={job.id} jobTitle={job.title} /> : null}

            <Tabs
              defaultValue="screening"
              items={[
                {
                  value: 'screening',
                  label: 'Screening questions',
                  content: (
                    <ScreeningQuestionBuilder
                      job={job}
                      addJobQuestionAction={addJobQuestionAction}
                      deleteJobQuestionAction={deleteJobQuestionAction}
                      duplicateJobQuestionAction={duplicateJobQuestionAction}
                      reorderJobQuestionsAction={reorderJobQuestionsAction}
                      updateJobQuestionAction={updateJobQuestionAction}
                    />
                  ),
                },
                ...(candidateRankingEnabled && canReadCandidateRanking ? [{
                  value: 'ai-candidate-ranking',
                  label: 'AI Candidate Ranking',
                  content: (
                    <JobCandidateRankingPanel
                      jobId={job.id}
                      initialRanking={initialCandidateRanking}
                      initialStatus={initialCandidateRankingStatus}
                      featureEnabled={candidateRankingEnabled}
                      canRead={canReadCandidateRanking}
                      canGenerate={canGenerateCandidateRanking}
                    />
                  ),
                }] : []),
              ]}
            />
          </>
        ) : null}
    </WorkspaceShell>
  );
}
