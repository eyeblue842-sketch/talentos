import Link from 'next/link';
import { JobCandidateRankingPanel } from '@/components/sections/job-candidate-ranking-panel';
import { RecruiterAiJobDescriptionPanel } from '@/components/sections/recruiter-ai-job-description-panel';
import { RecruiterJobEditForm } from '@/components/sections/recruiter-job-edit-form';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function statusTone(status) {
  if (status === 'OPEN') return 'success';
  if (status === 'DRAFT' || status === 'ON_HOLD') return 'warning';
  if (status === 'ARCHIVED') return 'neutral';
  return 'danger';
}

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
            <Card className="bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-[var(--font-display)] text-3xl font-semibold">{job.title}</h1>
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{job.location} • {job.employmentType} {job.workplaceType ? `• ${job.workplaceType}` : ''}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Applicants: {job.applicationsCount || 0} • Requisition: {job.requisition?.requisitionCode || 'None'}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {job.salaryMin != null || job.salaryMax != null ? `${job.currency || 'INR'} ${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} LPA` : 'Salary not set'}
                    {!job.publicSalaryEnabled ? <span className="ml-2 font-semibold text-amber-600">Salary hidden from candidates</span> : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={updateJobStatusAction.bind(null, job.id)}>
                    <input type="hidden" name="status" value={job.status === 'OPEN' ? 'CLOSED' : 'OPEN'} />
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">
                      {job.status === 'OPEN' ? 'Close job' : 'Open job'}
                    </button>
                  </form>
                  <form action={updateJobStatusAction.bind(null, job.id)}>
                    <input type="hidden" name="status" value="ARCHIVED" />
                    <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Archive</button>
                  </form>
                  <form action={deleteJobAction.bind(null, job.id)}>
                    <button className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete</button>
                  </form>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <RecruiterJobEditForm
                job={job}
                assignees={assignees}
                requisitions={requisitions}
                updateJobAction={updateJobAction.bind(null, job.id)}
              />

              <Card>
                <h2 className="font-[var(--font-display)] text-2xl font-semibold">Job summary</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <p><span className="font-semibold">Recruiter owner:</span> {job.recruiter?.email || 'Unassigned'}</p>
                  <p><span className="font-semibold">Hiring manager:</span> {job.hiringManager?.email || 'Unassigned'}</p>
                  <p><span className="font-semibold">Department:</span> {job.department || 'Not set'}</p>
                  <p><span className="font-semibold">Business unit:</span> {job.businessUnit || 'Not set'}</p>
                  <p><span className="font-semibold">Openings:</span> {job.numberOfOpenings || 1}</p>
                  <p><span className="font-semibold">Deadline:</span> {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleString() : 'No deadline'}</p>
                  <p><span className="font-semibold">Opens:</span> {job.applicationOpensAt ? new Date(job.applicationOpensAt).toLocaleString() : 'Immediate'}</p>
                  <p><span className="font-semibold">Closes:</span> {job.applicationClosesAt ? new Date(job.applicationClosesAt).toLocaleString() : 'No closing date'}</p>
                  <p><span className="font-semibold">Visibility:</span> {job.visibility}</p>
                  <p><span className="font-semibold">Pipeline summary:</span> {job.pipelineSummary?.map((item) => `${item.stage}: ${item.count}`).join(', ') || 'No applicants yet'}</p>
                </div>
                <Link href={`/recruiter/ats?jobId=${job.id}`} className="mt-6 inline-flex rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Open ATS pipeline</Link>
              </Card>
            </div>

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
