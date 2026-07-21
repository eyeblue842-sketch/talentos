import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { RecruiterApplicationDetailView } from '@/components/sections/recruiter-application-detail-view';
import { RecruiterOfferWorkflowPanel } from '@/components/sections/recruiter-offer-workflow-panel';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import {
  getCandidateMatchIntelligence,
  getCurrentOrganisation,
  getInterviewIntelligence,
  getOrganisationMembers,
  getRecruiterApplicationV2,
  getRecruiterOffersByApplication,
  getResumeIntelligence,
} from '@/lib/api';
import { RecruiterApplicationIntelligencePanel } from '@/components/sections/recruiter-application-intelligence-panel';
import {
  addInterviewRoundAction,
  addNoteAction,
  cancelInterviewAction,
  createOfferDraftAction,
  createInterviewPlanAction,
  deleteNoteAction,
  decideInterviewRoundAction,
  duplicateInterviewRoundAction,
  editNoteAction,
  actOnOfferApprovalAction,
  createOfferRevisionAction,
  moveApplicationStageAction,
  releaseOfferAction,
  requestOfferApprovalAction,
  scheduleInterviewAction,
  submitInterviewFeedbackAction,
  updateOfferDraftAction,
  updateOfferJoiningAction,
  withdrawOfferAction,
} from '../../actions';

const actions = {
  addInterviewRoundAction,
  addNoteAction,
  actOnOfferApprovalAction,
  cancelInterviewAction,
  createOfferDraftAction,
  createOfferRevisionAction,
  createInterviewPlanAction,
  deleteNoteAction,
  decideInterviewRoundAction,
  duplicateInterviewRoundAction,
  editNoteAction,
  moveApplicationStageAction,
  releaseOfferAction,
  requestOfferApprovalAction,
  scheduleInterviewAction,
  submitInterviewFeedbackAction,
  updateOfferDraftAction,
  updateOfferJoiningAction,
  withdrawOfferAction,
};

export default async function RecruiterApplicationDetailPage({ params }) {
  const { applicationId } = await params;

  let application = null;
  let organisation = null;
  let members = [];
  let offers = [];
  let resumeIntelligence = null;
  let matchIntelligence = null;
  let interviewIntelligence = null;
  let error = '';

  try {
    [organisation, application, members] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterApplicationV2(applicationId),
      getOrganisationMembers(),
    ]);
    offers = application?.applicationId ? await getRecruiterOffersByApplication(application.applicationId) : [];
    if (application?.candidate?.id && application?.job?.id) {
      [resumeIntelligence, matchIntelligence] = await Promise.all([
        getResumeIntelligence({ candidateId: application.candidate.id }).catch(() => null),
        getCandidateMatchIntelligence({ candidateId: application.candidate.id, jobId: application.job.id }).catch(() => null),
      ]);
      interviewIntelligence = await getInterviewIntelligence({
        applicationId: application.applicationId || application.id,
        mode: 'QUESTION_SET',
      }).catch(() => null);
    }
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title={application?.candidate?.fullName || 'Application detail'}
        description={application?.job?.title || 'Inspect ATS state, interviews, recruiter notes, and application activity.'}
        breadcrumb={[{ label: 'Recruiter' }, { label: 'ATS Pipeline', href: '/recruiter/ats' }, { label: application?.publicReference || 'Application' }]}
        secondaryActions={[{ label: 'Back to ATS pipeline', href: '/recruiter/ats' }]}
      />
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {application ? <RecruiterApplicationDetailView application={application} members={members} actions={actions} /> : null}
        {application ? (
          <RecruiterApplicationIntelligencePanel
            applicationId={application.applicationId || application.id}
            candidateId={application.candidate.id}
            jobId={application.job.id}
            initialResume={resumeIntelligence}
            initialMatch={matchIntelligence}
            initialInterview={interviewIntelligence}
          />
        ) : null}
        {application ? <RecruiterOfferWorkflowPanel application={application} members={members} offers={offers} actions={actions} /> : null}
    </WorkspaceShell>
  );
}
