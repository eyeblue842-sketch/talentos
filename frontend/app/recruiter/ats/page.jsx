import Link from 'next/link';
import { Briefcase, Users } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { AddAtsOpeningButton } from '@/components/recruiter/add-ats-opening-button';
import { ScheduleInterviewButton } from '@/components/recruiter/schedule-interview-button';
import { CreateOfferButton } from '@/components/recruiter/create-offer-button';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterPipelinePage, getRecruiterAtsOpenings, getOrganisationMembers, getRecruiterAssessmentTemplates, getRecruiterOfferTemplates } from '@/lib/api';
import { moveApplicationStageAction, closeAtsOpeningAction } from '../actions';

const stages = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER', 'HIRED', 'OFFER_DECLINED', 'REJECTED'];
const stageLabel = (stage) => stage.replaceAll('_', ' ');

export default async function RecruiterAtsPage({ searchParams }) {
  const params = await searchParams;
  const selectedJobId = typeof params?.jobId === 'string' ? params.jobId : '';

  let organisation = null;
  let openings = [];
  let pipeline = { items: [] };
  let members = [];
  let assessmentTemplates = [];
  let offerTemplates = [];
  let error = '';

  try {
    [organisation, openings] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterAtsOpenings(),
    ]);
    if (selectedJobId) {
      const query = new URLSearchParams();
      query.set('jobId', selectedJobId);
      [pipeline, members, assessmentTemplates, offerTemplates] = await Promise.all([
        getRecruiterPipelinePage(query.toString()),
        getOrganisationMembers().catch(() => []),
        getRecruiterAssessmentTemplates().catch(() => []),
        getRecruiterOfferTemplates().catch(() => []),
      ]);
    }
  } catch (caught) {
    error = caught.message;
  }

  const selectedOpening = (openings || []).find((opening) => opening.id === selectedJobId) || null;

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="ATS Pipeline"
        description="Manage candidates by opening. Add candidates from resume search into an opening's pipeline."
        breadcrumb={selectedOpening
          ? [{ label: 'Recruiter' }, { label: 'ATS Pipeline', href: '/recruiter/ats' }, { label: selectedOpening.title }]
          : [{ label: 'Recruiter' }, { label: 'ATS Pipeline' }]}
        secondaryActions={selectedJobId ? [{ label: 'All openings', href: '/recruiter/ats' }] : []}
      />

      {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}

      {!selectedJobId ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text)]">Open positions</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Every opening in your ATS — published jobs and ATS-only requirements. Open one to manage its pipeline.</p>
              </div>
              <AddAtsOpeningButton />
            </div>
          </Card>

          {openings.length === 0 ? (
            <Card>
              <EmptyState
                icon={Briefcase}
                title="No openings yet"
                description="Add a job opening, then associate candidates to it from resume search — or publish a job and its applicants appear here."
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openings.map((opening) => (
                <Link key={opening.id} href={`/recruiter/ats?jobId=${opening.id}`} className="block">
                  <Card className="h-full transition hover:border-[var(--color-primary)]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-[var(--color-text)]">{opening.title}</h3>
                      <Badge tone={opening.atsOnly ? 'neutral' : 'info'}>{opening.atsOnly ? 'ATS only' : 'Posted'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {[opening.department, opening.location, opening.employmentType?.replaceAll('_', ' ')].filter(Boolean).join(' • ') || 'No details added'}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-text)]">
                        <Users size={15} aria-hidden="true" />
                        {opening.totalCandidates} candidate{opening.totalCandidates === 1 ? '' : 's'}
                      </span>
                      <span className="text-[var(--color-text-secondary)]">{opening.numberOfOpenings} opening{opening.numberOfOpenings === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                      {stages.map((stage) => (
                        <span key={stage}>{stageLabel(stage)}: <span className="font-semibold text-[var(--color-text)]">{opening.stageCounts?.[stage] ?? 0}</span></span>
                      ))}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {selectedOpening ? (
            <Card className="bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-[var(--color-text)]">{selectedOpening.title}</h2>
                    <Badge tone={selectedOpening.atsOnly ? 'neutral' : 'info'}>{selectedOpening.atsOnly ? 'ATS only' : 'Posted'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {[selectedOpening.department, selectedOpening.location, selectedOpening.employmentType?.replaceAll('_', ' ')].filter(Boolean).join(' • ') || 'No details added'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{selectedOpening.totalCandidates} candidate{selectedOpening.totalCandidates === 1 ? '' : 's'} in this opening • {selectedOpening.numberOfOpenings} opening{selectedOpening.numberOfOpenings === 1 ? '' : 's'}</p>
                  {selectedOpening.salaryMin || selectedOpening.salaryMax ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Salary: {selectedOpening.salaryMin ? `₹${Number(selectedOpening.salaryMin).toLocaleString('en-IN')}` : '—'}
                      {selectedOpening.salaryMax ? ` – ₹${Number(selectedOpening.salaryMax).toLocaleString('en-IN')}` : ''}
                    </p>
                  ) : null}
                  {selectedOpening.hiringManagerName || selectedOpening.hiringManagerEmail ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Hiring manager: {[selectedOpening.hiringManagerName, selectedOpening.hiringManagerEmail].filter(Boolean).join(' • ')}</p>
                  ) : null}
                  {selectedOpening.interviewRounds?.length ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Interview rounds: {selectedOpening.interviewRounds.map((r) => r.roundName).join(' → ')}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/recruiter/database/results" className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
                    Add candidates from search
                  </Link>
                  <form action={closeAtsOpeningAction.bind(null, selectedOpening.id)}>
                    <button className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]">Close opening</button>
                  </form>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-5">
            {stages.map((stage) => {
              const items = pipeline.items.filter((application) => application.currentStage === stage);
              return (
                <Card key={stage} className="bg-[var(--surface)]">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{stageLabel(stage)}</p>
                    <Badge tone="brand">{items.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {items.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">No candidates.</p> : null}
                    {items.map((application) => (
                      <div key={application.id} className="rounded-2xl border border-[var(--line)] bg-white p-3 text-sm">
                        <p className="font-semibold">{application.candidate?.fullName || 'Candidate'}</p>
                        {application.appliedAt ? <p className="mt-1 text-[var(--color-text-secondary)]">Added {new Date(application.appliedAt).toLocaleDateString()}</p> : null}
                        <form action={moveApplicationStageAction.bind(null, application.id)} className="mt-3 space-y-2">
                          <select name="stage" defaultValue={application.currentStage} className="w-full rounded-2xl border border-[var(--line)] px-3 py-2">
                            {stages.map((option) => <option key={option} value={option}>{stageLabel(option)}</option>)}
                          </select>
                          <button className="w-full rounded-2xl border border-[var(--line)] px-3 py-2 font-semibold">Move stage</button>
                        </form>
                        <ScheduleInterviewButton
                          applicationId={application.id}
                          candidateName={application.candidate?.fullName || 'Candidate'}
                          members={members}
                          templates={assessmentTemplates}
                          plannedRounds={selectedOpening?.interviewRounds || []}
                        />
                        {stage === 'SELECTED' ? (
                          <CreateOfferButton applicationId={application.id} candidateName={application.candidate?.fullName || 'Candidate'} templates={offerTemplates} />
                        ) : null}
                        {stage === 'OFFER' ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={moveApplicationStageAction.bind(null, application.id)}>
                              <input type="hidden" name="stage" value="HIRED" />
                              <button className="rounded-2xl bg-[var(--color-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)]">Offer accepted</button>
                            </form>
                            <form action={moveApplicationStageAction.bind(null, application.id)}>
                              <input type="hidden" name="stage" value="OFFER_DECLINED" />
                              <button className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">Offer declined</button>
                            </form>
                          </div>
                        ) : null}
                        {application.submittedApplicationId ? (
                          <Link href={`/recruiter/ats/${application.submittedApplicationId}`} className="mt-3 inline-flex font-semibold text-[var(--brand)]">Open application</Link>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}
