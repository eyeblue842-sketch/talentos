import { JobCandidateRankingPanel } from '@/components/sections/job-candidate-ranking-panel';
import { RecruiterAiJobDescriptionPanel } from '@/components/sections/recruiter-ai-job-description-panel';
import { RecruiterJobDetailView } from '@/components/sections/recruiter-job-detail-view';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ScreeningQuestionBuilder } from '@/components/sections/screening-question-builder';
import { Tabs } from '@/components/ui/tabs';
import { recruiterNav } from '@/lib/navigation';
import {
  getApprovedRequisitions,
  getCandidateRanking,
  getCandidateRankingStatus,
  getCurrentOrganisation,
  getJobDescriptionDrafts,
  getJobDescriptionHistory,
  getJobDescriptionIntelligence,
  getJobDescriptionIntelligenceStatus,
  getJobDescriptionTemplates,
  getOrganisationMembers,
  getRecruiterJob,
  getRecruiterScreeningTemplates,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  addJobQuestionAction,
  addJobQuestionFromLibraryAction,
  createScreeningTemplateAction,
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
  let requisitions = [];
  let templates = [];
  let currentUser = null;
  let error = '';
  let initialJobDescription = null;
  let initialJobDescriptionStatus = null;
  let initialJobDescriptionDrafts = [];
  let initialJobDescriptionTemplates = [];
  let initialJobDescriptionHistory = null;
  let initialCandidateRanking = null;
  let initialCandidateRankingStatus = null;

  const aiJobDescriptionEnabled = isFeatureEnabled('aiJobDescription');
  const candidateRankingEnabled = isFeatureEnabled('candidateRanking');

  try {
    [organisation, job, members, requisitions, templates, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterJob(jobId),
      getOrganisationMembers(),
      getApprovedRequisitions(),
      getRecruiterScreeningTemplates(),
      getCurrentUser(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const assignees = members.filter((member) => ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(member.role));
  const canReadAiJobDescription = hasUserPermission(currentUser, 'intelligence.job.read')
    || hasUserPermission(currentUser, 'intelligence.job.generate');
  const canGenerateAiJobDescription = hasUserPermission(currentUser, 'intelligence.job.generate');
  const canReadCandidateRanking = hasUserPermission(currentUser, 'intelligence.ranking.read');
  const canGenerateCandidateRanking = hasUserPermission(currentUser, 'intelligence.ranking.generate');

  if (job && aiJobDescriptionEnabled && canReadAiJobDescription) {
    const [jobDescriptionResult, jobDescriptionStatus, jobDescriptionDrafts, jobDescriptionTemplates, jobDescriptionHistory] = await Promise.all([
      getJobDescriptionIntelligence(job.id).catch(() => null),
      getJobDescriptionIntelligenceStatus(job.id).catch(() => null),
      getJobDescriptionDrafts(job.id).catch(() => []),
      getJobDescriptionTemplates().catch(() => []),
      getJobDescriptionHistory(job.id).catch(() => null),
    ]);
    initialJobDescription = jobDescriptionResult;
    initialJobDescriptionStatus = jobDescriptionStatus;
    initialJobDescriptionDrafts = jobDescriptionDrafts;
    initialJobDescriptionTemplates = jobDescriptionTemplates;
    initialJobDescriptionHistory = jobDescriptionHistory;
  }

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
        description={job ? 'Review ownership, pipeline summary, and screening setup for this organisation job.' : 'Recruiter job detail workspace.'}
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Jobs', href: '/recruiter/jobs' }, { label: job?.title || 'Detail' }]}
        secondaryActions={[{ label: 'Back to jobs', href: '/recruiter/jobs' }]}
      />
        {query?.notice ? <p className="text-sm font-semibold text-[var(--brand)]">{query.notice}</p> : null}
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {job ? (
          <>
            <RecruiterJobDetailView
              job={job}
              assignees={assignees}
              requisitions={requisitions}
              updateJobAction={updateJobAction.bind(null, job.id)}
              closeReopenAction={updateJobStatusAction.bind(null, job.id)}
              archiveAction={updateJobStatusAction.bind(null, job.id)}
              deleteAction={deleteJobAction.bind(null, job.id)}
              atsHref={`/recruiter/ats?jobId=${job.id}`}
            />

            <Tabs
              defaultValue="screening"
              items={[
                {
                  value: 'screening',
                  label: 'Screening Setup',
                  content: (
                    <ScreeningQuestionBuilder
                      job={job}
                      templates={templates}
                      addJobQuestionAction={addJobQuestionAction}
                      addJobQuestionFromLibraryAction={addJobQuestionFromLibraryAction}
                      createScreeningTemplateAction={createScreeningTemplateAction}
                      deleteJobQuestionAction={deleteJobQuestionAction}
                      duplicateJobQuestionAction={duplicateJobQuestionAction}
                      reorderJobQuestionsAction={reorderJobQuestionsAction}
                      updateJobQuestionAction={updateJobQuestionAction}
                    />
                  ),
                },
                ...(aiJobDescriptionEnabled && canReadAiJobDescription ? [{
                  value: 'ai-job-description',
                  label: 'AI Job Description',
                  content: (
                    <RecruiterAiJobDescriptionPanel
                      jobId={job.id}
                      initialResult={initialJobDescription}
                      initialStatus={initialJobDescriptionStatus}
                      initialDrafts={initialJobDescriptionDrafts}
                      initialTemplates={initialJobDescriptionTemplates}
                      initialHistory={initialJobDescriptionHistory}
                      initialLiveJob={job}
                      featureEnabled={aiJobDescriptionEnabled}
                      canRead={canReadAiJobDescription}
                      canGenerate={canGenerateAiJobDescription}
                    />
                  ),
                }] : []),
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
