import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { RecruiterApplicationDetailView } from '@/components/sections/recruiter-application-detail-view';
import { recruiterNav } from '@/lib/mock-data';
import { getOrganisationMembers, getRecruiterApplicationV2 } from '@/lib/api';
import {
  addNoteAction,
  cancelInterviewAction,
  deleteNoteAction,
  editNoteAction,
  moveApplicationStageAction,
  scheduleInterviewAction,
} from '../../actions';

const actions = {
  addNoteAction,
  cancelInterviewAction,
  deleteNoteAction,
  editNoteAction,
  moveApplicationStageAction,
  scheduleInterviewAction,
};

export default async function RecruiterApplicationDetailPage({ params }) {
  const { applicationId } = await params;

  let application = null;
  let members = [];
  let error = '';

  try {
    [application, members] = await Promise.all([
      getRecruiterApplicationV2(applicationId),
      getOrganisationMembers(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Link href="/recruiter/ats" className="text-sm font-semibold text-[var(--brand)]">Back to ATS pipeline</Link>
        {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
        {application ? <RecruiterApplicationDetailView application={application} members={members} actions={actions} /> : null}
      </section>
    </main>
  );
}
