import Link from 'next/link';
import { Download, Mail, ShieldCheck } from 'lucide-react';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { CandidateJobMatchPanel } from '@/components/sections/candidate-job-match-panel';
import { CandidateInsightsPanel } from '@/components/sections/candidate-insights-panel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';
import { recruiterNav } from '@/lib/navigation';
import {
  getCandidateJobMatch,
  getCandidateJobMatchStatus,
  getCandidateProfileIntelligence,
  getCandidateProfileIntelligenceStatus,
  getCurrentOrganisation,
  getProfessionalProfile,
  getRecruiterCandidatePreview,
  getRecruiterJob,
} from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { hasUserPermission } from '@/lib/enterprise-permissions';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { decorateResumePreview } from '@/lib/recruiter-resume-search';
import { saveCandidateAction, unsaveCandidateAction } from '../../actions';

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
  let initialIntelligence = null;
  let initialIntelligenceStatus = null;
  let initialMatch = null;
  let initialMatchStatus = null;
  let selectedJob = null;
  let networkProfile = null;

  const candidateIntelligenceEnabled = isFeatureEnabled('candidateIntelligence');
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

  const canReadCandidateIntelligence = hasUserPermission(currentUser, 'intelligence.candidate.read');
  const canGenerateCandidateIntelligence = hasUserPermission(currentUser, 'intelligence.candidate.generate');
  const canReadCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.read');
  const canGenerateCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.generate');
  const canOverrideCandidateMatch = hasUserPermission(currentUser, 'intelligence.match.override');

  if (candidate && candidateIntelligenceEnabled && canReadCandidateIntelligence) {
    const [intelligenceResult, intelligenceStatus] = await Promise.all([
      getCandidateProfileIntelligence(candidateId).catch(() => null),
      getCandidateProfileIntelligenceStatus(candidateId).catch(() => null),
    ]);
    initialIntelligence = intelligenceResult;
    initialIntelligenceStatus = intelligenceStatus;
  }

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

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Careeriz Hire'}
        title={candidate?.fullName || 'Candidate Profile'}
        description={candidate?.title || 'Recruiter candidate detail'}
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
                <div className="flex flex-wrap gap-2">
                  <Badge variant="brand">{candidate.matchScore}% match</Badge>
                  <Badge variant="neutral">Resume {candidate.resumeScore}</Badge>
                  <Badge variant="neutral">{candidate.globalHiringStatus}</Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{candidate.location || 'Location not shared'} • {candidate.totalExperienceLabel || `${candidate.totalExperience || 0} yrs`} • {candidate.noticePeriod || 'Availability not added'}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                  <span>{candidate.currentDesignation || candidate.currentTitle || 'Designation not added'}</span>
                  <span>{candidate.currentEmployer || candidate.currentCompany || 'Company not added'}</span>
                  {candidate.preferredLocations?.length ? <span>Preferred: {candidate.preferredLocations.join(', ')}</span> : null}
                  {candidate.salaryVisible ? <span>Current CTC: {candidate.currentSalary ?? 'Not disclosed'} LPA</span> : null}
                  {candidate.salaryVisible ? <span>Expected CTC: {candidate.expectedSalary ?? 'Not disclosed'} LPA</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {candidate.resumeDownloadUrl ? (
                  <Link href={candidate.resumeDownloadUrl} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">
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

          <Tabs
            defaultValue={query?.tab === 'ai-match' ? 'ai-match' : (query?.tab === 'candidate-insights' ? 'candidate-insights' : 'overview')}
            items={[
              {
                value: 'overview',
                label: 'Profile Details',
                content: (
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card>
                      <h2 className="text-2xl font-semibold text-[var(--color-text)]">Professional Summary</h2>
                      <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{candidate.summary || 'No professional summary is available.'}</p>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--line)] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Current Company</p>
                          <p className="mt-2 font-semibold text-[var(--color-text)]">{candidate.currentEmployer || candidate.currentCompany || 'Not added'}</p>
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
                        <h3 className="text-lg font-semibold text-[var(--color-text)]">Work Experience</h3>
                        <div className="mt-3 space-y-3">
                          {(candidate.experienceEntries || []).length ? candidate.experienceEntries.map((entry, index) => (
                            <div key={`${entry.id || entry.company || 'experience'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                              <p className="font-semibold text-[var(--color-text)]">{entry.title || entry.jobTitle || entry.designation || 'Role not added'}</p>
                              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.company || entry.employer || 'Company not added'}</p>
                              <p className="mt-2 text-xs text-[var(--color-text-muted)]">{entry.startDate || entry.startYear || 'Start date not added'} - {entry.isCurrent ? 'Present' : (entry.endDate || entry.endYear || 'End date not added')}</p>
                              {entry.description ? <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{entry.description}</p> : null}
                            </div>
                          )) : <p className="text-sm text-[var(--color-text-secondary)]">No structured work experience is available.</p>}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-[var(--color-text)]">Education</h3>
                        <div className="mt-3 space-y-3">
                          {(candidate.educationEntries || []).length ? candidate.educationEntries.map((entry, index) => (
                            <div key={`${entry.id || entry.degree || 'education'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-4">
                              <p className="font-semibold text-[var(--color-text)]">{entry.degree || entry.course || 'Qualification not added'}</p>
                              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.institution || entry.school || 'Institute not added'}</p>
                              {entry.endYear || entry.completionYear ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Completed {entry.endYear || entry.completionYear}</p> : null}
                            </div>
                          )) : <p className="text-sm text-[var(--color-text-secondary)]">No structured education is available.</p>}
                        </div>
                      </div>

                      {(candidate.projectEntries || []).length ? (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold text-[var(--color-text)]">Projects</h3>
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
                        </div>
                      ) : null}

                      {(candidate.certificationEntries || []).length ? (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold text-[var(--color-text)]">Certifications</h3>
                          <div className="mt-3 space-y-2">
                            {candidate.certificationEntries.map((entry, index) => (
                              <div key={`${entry.id || entry.name || 'certification'}-${index}`} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                                <p className="font-semibold text-[var(--color-text)]">{entry.name || entry.title}</p>
                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.issuer || entry.organization || 'Issuer not added'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {(candidate.languageEntries || []).length ? (
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold text-[var(--color-text)]">Languages</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {candidate.languageEntries.map((entry, index) => <Badge key={`${entry.id || entry.language || 'language'}-${index}`} variant="neutral">{entry.language || entry.name}{entry.proficiency ? ` - ${entry.proficiency}` : ''}</Badge>)}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-[var(--color-text)]">Career Preferences</h3>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
                          <p>Preferred roles: {candidate.preferredRoles?.length ? candidate.preferredRoles.join(', ') : 'Not added'}</p>
                          <p>Employment: {candidate.employmentPreferences?.length ? candidate.employmentPreferences.join(', ') : 'Not added'}</p>
                          <p>Workplace: {candidate.workplacePreferences?.length ? candidate.workplacePreferences.join(', ') : 'Not added'}</p>
                          <p>Work authorization: {candidate.workAuthorization || 'Not added'}</p>
                          <p>Relocation: {candidate.willingToRelocate == null ? 'Not added' : candidate.willingToRelocate ? 'Willing to relocate' : 'Not willing to relocate'}</p>
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
                              {candidate.contactEmail || 'Email not shared'}
                            </div>
                            {candidate.contactPhone ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Phone: {candidate.contactPhone}</p> : null}
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
                ),
              },
              {
                value: 'resume',
                label: 'Attached CV',
                content: (
                  <Card>
                    <h2 className="text-xl font-semibold text-[var(--color-text)]">Attached CV</h2>
                    {candidate.resumeDownloadUrl ? (
                      <div className="mt-4 space-y-4">
                        <p className="text-sm text-[var(--color-text-secondary)]">View the original resume supplied by this candidate.</p>
                        <div className="flex flex-wrap gap-3">
                          <Link href={candidate.resumeDownloadUrl} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"><Download size={16} aria-hidden="true" />View Resume</Link>
                          <Link href={candidate.resumeDownloadUrl} download className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold"><Download size={16} aria-hidden="true" />Download Resume</Link>
                        </div>
                      </div>
                    ) : <p className="mt-4 text-sm text-[var(--color-text-secondary)]">No resume is attached to this profile.</p>}
                  </Card>
                ),
              },
              {
                value: 'candidate-insights',
                label: 'Candidate Insights',
                content: (
                  <CandidateInsightsPanel
                    candidateId={candidate.id}
                    initialResult={initialIntelligence}
                    initialStatus={initialIntelligenceStatus}
                    featureEnabled={candidateIntelligenceEnabled}
                    canRead={canReadCandidateIntelligence}
                    canGenerate={canGenerateCandidateIntelligence}
                  />
                ),
              },
              {
                value: 'ai-match',
                label: 'AI Match',
                content: (
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
                ),
              },
            ]}
          />
        </>
      ) : null}
    </WorkspaceShell>
  );
}
