import Link from 'next/link';
import { Download, Mail, ShieldCheck } from 'lucide-react';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { CandidateJobMatchPanel } from '@/components/sections/candidate-job-match-panel';
import { AssociateToJobButton } from '@/components/recruiter/associate-to-job-button';
import { AiMatchJobSelector } from '@/components/recruiter/ai-match-job-selector';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';
import { recruiterNav } from '@/lib/navigation';
import {
  getCandidateJobMatch,
  getCandidateJobMatchStatus,
  getCurrentOrganisation,
  getProfessionalProfile,
  getRecruiterCandidatePreview,
  getRecruiterJob,
  getRecruiterJobs,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { decorateResumePreview } from '@/lib/recruiter-resume-search';

function formatCtc(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `${numeric} LPA`;
  return String(value);
}

function uniqueEmployerCount(experienceEntries = []) {
  const employers = experienceEntries
    .map((entry) => (entry.company || entry.employer || '').trim().toLowerCase())
    .filter(Boolean);
  const distinct = new Set(employers);
  return distinct.size || experienceEntries.length || 0;
}

// Compact single-row contact bar so it takes minimal height and leaves the profile
// content the full width.
function ContactInformationCard({ candidate }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Contact</h2>
        {candidate.showContactInfo ? (
          <>
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
              <Mail size={15} aria-hidden="true" />
              {candidate.contactEmail || 'Email not shared'}
            </span>
            {candidate.contactPhone ? (
              <span className="text-sm text-[var(--color-text-secondary)]">Phone: {candidate.contactPhone}</span>
            ) : null}
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <ShieldCheck size={15} aria-hidden="true" className="text-[var(--color-primary)]" />
            Contact details are permission-gated for this candidate.
          </span>
        )}
      </div>
    </Card>
  );
}

export default async function RecruiterCandidateDetailPage({ params, searchParams }) {
  const { candidateId } = await params;
  const query = await searchParams;
  const selectedJobId = typeof query?.jobId === 'string' ? query.jobId : '';
  const returnTo = typeof query?.returnTo === 'string' && query.returnTo.startsWith('/recruiter/database/results')
    ? query.returnTo
    : '/recruiter/database/results';

  let candidate = null;
  let organisation = null;
  let currentUser = null;
  let error = '';
  let initialMatch = null;
  let initialMatchStatus = null;
  let selectedJob = null;
  let networkProfile = null;

  const candidateMatchingEnabled = isFeatureEnabled('candidateMatching');

  try {
    [organisation, candidate, currentUser] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterCandidatePreview(candidateId).then(decorateResumePreview),
      getCurrentUser(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  const canReadCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.read');
  const canGenerateCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.generate');
  const canOverrideCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.override');

  if (candidate && selectedJobId && candidateMatchingEnabled && canReadCandidateMatch) {
    const [jobResult, matchResult, matchStatus] = await Promise.all([
      getRecruiterJob(selectedJobId).catch(() => null),
      getCandidateJobMatch(selectedJobId, candidateId).catch(() => null),
      getCandidateJobMatchStatus(selectedJobId, candidateId).catch(() => null),
    ]);
    selectedJob = jobResult;
    initialMatch = matchResult;
    initialMatchStatus = matchStatus;
  }

  if (candidate?.userId) {
    networkProfile = await getProfessionalProfile(candidate.userId).catch(() => null);
  }

  let openJobs = [];
  if (candidate && candidateMatchingEnabled && canReadCandidateMatch) {
    const jobs = await getRecruiterJobs().catch(() => []);
    openJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => !job.status || job.status === 'OPEN');
  }

  const currentCtc = candidate && candidate.salaryVisible !== false ? formatCtc(candidate.currentSalary) : null;
  const expectedCtc = candidate && candidate.salaryVisible !== false ? formatCtc(candidate.expectedSalary) : null;
  const highestEducation = candidate?.educationEntries?.[0] || null;
  const employerCount = candidate ? uniqueEmployerCount(candidate.experienceEntries) : 0;
  const noticeLabel = candidate?.noticePeriodDays != null
    ? `${candidate.noticePeriodDays} days notice`
    : 'Notice period not added';

  const snapshot = candidate ? [
    ['Total experience', candidate.totalExperienceLabel || `${candidate.totalExperience || 0} yrs`],
    ['Current role', candidate.currentDesignation || candidate.currentTitle || 'Not added'],
    ['Current company', candidate.currentEmployer || candidate.currentCompany || 'Not added'],
    ['Location', candidate.location || 'Not added'],
    ['Preferred locations', candidate.preferredLocations?.length ? candidate.preferredLocations.join(', ') : 'Not added'],
    ['Highest education', highestEducation ? `${highestEducation.degree || highestEducation.course || 'Qualification'}${highestEducation.institution ? ` — ${highestEducation.institution}` : ''}` : 'Not added'],
    ['Certifications', candidate.certificationEntries?.length ? `${candidate.certificationEntries.length}` : 'None'],
    ['Total employers', `${employerCount}`],
    ...(currentCtc ? [['Current CTC', currentCtc]] : []),
    ...(expectedCtc ? [['Expected CTC', expectedCtc]] : []),
    ['Notice period', noticeLabel],
  ] : [];

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} brandLogoUrl={organisation?.logoUrl} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title={candidate?.fullName || 'Candidate Profile'}
        description={candidate?.currentDesignation || candidate?.currentTitle || candidate?.title || 'Recruiter candidate detail'}
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Resume Search', href: returnTo }, { label: 'Profile' }]}
        secondaryActions={[{ label: 'Back to Search', href: returnTo }]}
      />

      {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}

      {candidate ? (
        <>
          <Card className="bg-[var(--surface)]">
            <div className="flex flex-wrap items-start gap-4">
              <CandidateAvatar src={candidate.profileImageUrl} name={candidate.fullName} sizeClassName="h-20 w-20" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {[candidate.location, candidate.totalExperienceLabel || `${candidate.totalExperience || 0} yrs`, noticeLabel].filter(Boolean).join(' • ')}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                  <span>{candidate.currentDesignation || candidate.currentTitle || 'Designation not added'}</span>
                  <span>{candidate.currentEmployer || candidate.currentCompany || 'Company not added'}</span>
                  {candidate.preferredLocations?.length ? <span>Preferred: {candidate.preferredLocations.join(', ')}</span> : null}
                  {currentCtc ? <span>Current CTC: {currentCtc}</span> : null}
                  {expectedCtc ? <span>Expected CTC: {expectedCtc}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {candidate.resumeDownloadUrl ? (
                  <Link href={candidate.resumeDownloadUrl} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">
                    <Download size={16} aria-hidden="true" />
                    Download resume
                  </Link>
                ) : null}
                <AssociateToJobButton candidateId={candidate.id} candidateName={candidate.fullName} />
              </div>
            </div>
          </Card>

          <Tabs
            defaultValue={query?.tab === 'ai-match' ? 'ai-match' : (query?.tab === 'resume' ? 'resume' : 'overview')}
            items={[
              {
                value: 'overview',
                label: 'Profile Details',
                content: (
                  <div className="space-y-6">
                    <ContactInformationCard candidate={candidate} />

                    <div className="space-y-6">
                      <div className="space-y-6">
                        <Card>
                          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Profile snapshot</h2>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {snapshot.map(([label, value]) => (
                              <div key={label} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
                                <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{value}</p>
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card>
                          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Professional Summary</h2>
                          <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{candidate.summary || 'No professional summary is available.'}</p>
                        </Card>

                        <Card>
                          <h3 className="text-xl font-semibold text-[var(--color-text)]">Skills</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {candidate.skills?.length ? candidate.skills.map((skill) => <Badge key={skill} variant="neutral">{skill}</Badge>) : <p className="text-sm text-[var(--color-text-secondary)]">No skills extracted.</p>}
                          </div>
                        </Card>

                        <Card>
                          <h3 className="text-xl font-semibold text-[var(--color-text)]">Work Experience</h3>
                          <div className="mt-3 space-y-3">
                            {(candidate.experienceEntries || []).length ? candidate.experienceEntries.map((entry, index) => (
                              <div key={`${entry.id || entry.company || 'experience'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                                <p className="font-semibold text-[var(--color-text)]">{entry.title || entry.jobTitle || entry.designation || 'Role not added'}</p>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.company || entry.employer || 'Company not added'}</p>
                                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{entry.startDate || entry.startYear || 'Start not added'} - {entry.isCurrent ? 'Present' : (entry.endDate || entry.endYear || 'End not added')}</p>
                                {entry.description ? <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{entry.description}</p> : null}
                              </div>
                            )) : <p className="text-sm text-[var(--color-text-secondary)]">No structured work experience is available.</p>}
                          </div>
                        </Card>

                        <Card>
                          <h3 className="text-xl font-semibold text-[var(--color-text)]">Career Preferences</h3>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
                            <p>Preferred roles: {candidate.preferredRoles?.length ? candidate.preferredRoles.join(', ') : 'Not added'}</p>
                            <p>Preferred locations: {candidate.preferredLocations?.length ? candidate.preferredLocations.join(', ') : 'Not added'}</p>
                            <p>Employment: {candidate.employmentPreferences?.length ? candidate.employmentPreferences.join(', ') : 'Not added'}</p>
                            <p>Workplace: {candidate.workplacePreferences?.length ? candidate.workplacePreferences.join(', ') : 'Not added'}</p>
                            <p>Work authorization: {candidate.workAuthorization || 'Not added'}</p>
                            <p>Relocation: {candidate.willingToRelocate == null ? 'Not added' : candidate.willingToRelocate ? 'Willing to relocate' : 'Not willing to relocate'}</p>
                          </div>
                        </Card>

                        <Card>
                          <h3 className="text-xl font-semibold text-[var(--color-text)]">Education</h3>
                          <div className="mt-3 space-y-3">
                            {(candidate.educationEntries || []).length ? candidate.educationEntries.map((entry, index) => (
                              <div key={`${entry.id || entry.degree || 'education'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                                <p className="font-semibold text-[var(--color-text)]">{entry.degree || entry.course || 'Qualification not added'}</p>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.institution || entry.school || 'Institute not added'}</p>
                                {entry.endYear || entry.completionYear ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Completed {entry.endYear || entry.completionYear}</p> : null}
                              </div>
                            )) : <p className="text-sm text-[var(--color-text-secondary)]">No structured education is available.</p>}
                          </div>
                        </Card>

                        {(candidate.projectEntries || []).length ? (
                          <Card>
                            <h3 className="text-xl font-semibold text-[var(--color-text)]">Projects</h3>
                            <div className="mt-3 space-y-3">
                              {candidate.projectEntries.map((entry, index) => (
                                <div key={`${entry.id || entry.projectName || 'project'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                                  <p className="font-semibold text-[var(--color-text)]">{entry.projectName || entry.name || 'Project'}</p>
                                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.clientOrCompany || entry.company || entry.role || 'Project details not added'}</p>
                                  {entry.technologies?.length ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{entry.technologies.join(' | ')}</p> : null}
                                  {entry.description ? <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{entry.description}</p> : null}
                                </div>
                              ))}
                            </div>
                          </Card>
                        ) : null}

                        {(candidate.certificationEntries || []).length ? (
                          <Card>
                            <h3 className="text-xl font-semibold text-[var(--color-text)]">Certifications</h3>
                            <div className="mt-3 space-y-2">
                              {candidate.certificationEntries.map((entry, index) => (
                                <div key={`${entry.id || entry.name || 'certification'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                                  <p className="font-semibold text-[var(--color-text)]">{entry.name || entry.title}</p>
                                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.issuer || entry.organization || 'Issuer not added'}</p>
                                </div>
                              ))}
                            </div>
                          </Card>
                        ) : null}

                        {(candidate.languageEntries || []).length ? (
                          <Card>
                            <h3 className="text-xl font-semibold text-[var(--color-text)]">Languages</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {candidate.languageEntries.map((entry, index) => <Badge key={`${entry.id || entry.language || 'language'}-${index}`} variant="neutral">{entry.language || entry.name}{entry.proficiency ? ` - ${entry.proficiency}` : ''}</Badge>)}
                            </div>
                          </Card>
                        ) : null}
                      </div>

                      <div className="space-y-6">
                        {networkProfile?.profile ? (
                          <Card>
                            <h2 className="text-xl font-semibold text-[var(--color-text)]">Professional Network</h2>
                            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                              {networkProfile.profile.mutualConnections.count
                                ? `${networkProfile.profile.mutualConnections.count} mutual connection${networkProfile.profile.mutualConnections.count === 1 ? '' : 's'}`
                                : 'Open this candidate’s networking profile when privacy allows.'}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <NetworkProfileActions
                                profile={networkProfile.profile}
                                redirectTo={`/recruiter/database/${candidate.id}`}
                                source="PEOPLE_SEARCH"
                                messageHref={`/recruiter/messages?user=${networkProfile.profile.userId}`}
                              />
                            </div>
                          </Card>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                value: 'resume',
                label: 'Attached CV',
                content: (
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">Attached CV</h2>
                      {candidate.resumeDownloadUrl ? (
                        <Link href={candidate.resumeDownloadUrl} download className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
                          <Download size={16} aria-hidden="true" />
                          Download resume
                        </Link>
                      ) : null}
                    </div>
                    {candidate.resumeDownloadUrl ? (
                      <div className="mt-4">
                        <iframe
                          title={`${candidate.fullName || 'Candidate'} resume`}
                          src={candidate.resumeDownloadUrl}
                          className="h-[80vh] w-full rounded-2xl border border-[var(--line)] bg-white"
                        />
                        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                          If the preview doesn’t display (e.g. a Word document), use “Download resume” to open the original file.
                        </p>
                      </div>
                    ) : <p className="mt-4 text-sm text-[var(--color-text-secondary)]">No resume is attached to this profile.</p>}
                  </Card>
                ),
              },
              {
                value: 'ai-match',
                label: 'AI Match',
                content: (
                  <>
                    <AiMatchJobSelector jobs={openJobs} currentJobId={selectedJobId} />
                    <CandidateJobMatchPanel
                      candidateId={candidate.id}
                      jobId={selectedJobId || null}
                      jobTitle={selectedJob?.title || ''}
                      initialResult={initialMatch}
                      initialStatus={initialMatchStatus}
                      featureEnabled={candidateMatchingEnabled}
                      canRead={canReadCandidateMatch}
                      canGenerate={canGenerateCandidateMatch}
                      canOverride={canOverrideCandidateMatch}
                    />
                  </>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </WorkspaceShell>
  );
}
