import Link from 'next/link';
import { Download, Mail, ShieldCheck } from 'lucide-react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterCandidatePreview } from '@/lib/api';
import { decorateResumePreview } from '@/lib/recruiter-resume-search';
import { saveCandidateAction, unsaveCandidateAction } from '../../actions';

export default async function RecruiterCandidateDetailPage({ params }) {
  const { candidateId } = await params;

  let candidate = null;
  let organisation = null;
  let error = '';

  try {
    [organisation, candidate] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterCandidatePreview(candidateId).then(decorateResumePreview),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title={candidate?.fullName || 'Candidate Profile'}
        description={candidate?.title || 'Recruiter candidate detail'}
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Search', href: '/recruiter/database' }, { label: 'Profile' }]}
        secondaryActions={[{ label: 'Back to Search', href: '/recruiter/database' }]}
      />

      {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}

      {candidate ? (
        <>
          <Card className="bg-[var(--surface)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="brand">{candidate.matchScore}% match</Badge>
                  <Badge variant="neutral">Resume {candidate.resumeScore}</Badge>
                  <Badge variant="neutral">{candidate.globalHiringStatus}</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{candidate.location || 'Location not shared'} • {candidate.totalExperienceLabel} • {candidate.noticePeriod}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {candidate.resumeUrl ? (
                  <Link href={candidate.resumeUrl} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">
                    <Download size={16} aria-hidden="true" />
                    Download Resume
                  </Link>
                ) : null}
                <form action={saveCandidateAction.bind(null, candidate.id)} className="flex gap-2">
                  <select name="tag" defaultValue="" className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm">
                    <option value="">Save without tag</option>
                    <option value="SHORTLISTED">Shortlisted</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="HOLD">Hold</option>
                  </select>
                  <button className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Save candidate</button>
                </form>
                <form action={unsaveCandidateAction.bind(null, candidate.id)}>
                  <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Remove saved</button>
                </form>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">AI Summary</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{candidate.aiSummary}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Current Company</p>
                  <p className="mt-2 font-semibold text-[var(--color-text)]">{candidate.currentCompany}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Salary Range</p>
                  <p className="mt-2 font-semibold text-[var(--color-text)]">{candidate.salaryLabel}</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">Skills</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.skills.map((skill) => <Badge key={skill} variant="neutral">{skill}</Badge>)}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">Timeline</h3>
                <div className="mt-3 space-y-3">
                  {candidate.timeline.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{item.label}</p>
                      <p className="mt-1 text-sm text-[var(--color-text)]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">ATS Status</h2>
                <div className="mt-4 space-y-3">
                  {candidate.atsPipeline.map((stage) => (
                    <div key={stage.label} className={`rounded-2xl border px-4 py-3 text-sm ${stage.current ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : stage.active ? 'border-[var(--line)]' : 'border-[var(--line)] text-[var(--color-text-muted)]'}`}>
                      {stage.label}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">Contact Information</h2>
                {candidate.showContactInfo ? (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                      <Mail size={16} aria-hidden="true" />
                      {candidate.contactEmail}
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Visible because organisation access rules allow recruiter detail access for this candidate.</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                      <ShieldCheck size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
                      Permission-based contact information
                    </div>
                    <p className="mt-2">Direct contact details remain hidden for this recruiter until a permitted access path is available.</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </WorkspaceShell>
  );
}
