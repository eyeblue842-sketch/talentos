import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { RecruiterApplicationDetailView } from '@/components/sections/recruiter-application-detail-view';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getOrganisationMembers, getRecruiterApplicationV2 } from '@/lib/api';
import {
  addInterviewRoundAction,
  addNoteAction,
  cancelInterviewAction,
  createInterviewPlanAction,
  deleteNoteAction,
  decideInterviewRoundAction,
  duplicateInterviewRoundAction,
  editNoteAction,
  moveApplicationStageAction,
  scheduleInterviewAction,
  submitInterviewFeedbackAction,
} from '../../actions';

const actions = {
  addInterviewRoundAction,
  addNoteAction,
  cancelInterviewAction,
  createInterviewPlanAction,
  deleteNoteAction,
  decideInterviewRoundAction,
  duplicateInterviewRoundAction,
  editNoteAction,
  moveApplicationStageAction,
  scheduleInterviewAction,
  submitInterviewFeedbackAction,
};

export default async function RecruiterApplicationDetailPage({ params }) {
  const { applicationId } = await params;

  let application = null;
  let organisation = null;
  let members = [];
  let error = '';

  try {
    [organisation, application, members] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterApplicationV2(applicationId),
      getOrganisationMembers(),
    ]);
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
    </WorkspaceShell>
  );
}
