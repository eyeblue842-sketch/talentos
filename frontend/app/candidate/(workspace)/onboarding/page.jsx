import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getCandidateOnboarding } from '@/lib/api';
import { submitCandidateOnboardingAction } from '../../actions';

export default async function CandidateOnboardingPage() {
  const onboarding = await getCandidateOnboarding();
  const { profile, completion, resumes } = onboarding;

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Candidate onboarding"
        title="Finish the practical details that power your applications"
        description="This onboarding flow is idempotent, prepopulates existing profile data, and can be resumed any time."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Onboarding' }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[32px] p-6">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Current progress</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">Profile completion is calculated from basic details, professional details, resume availability, skills, experience, education, preferences, and summary/links.</p>
          <div className="mt-5 rounded-[28px] border border-[var(--line)] bg-[var(--soft)] p-5">
            <p className="text-sm font-semibold text-[var(--brand)]">{completion.percentage}% complete</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{completion.recommendedNextAction}</p>
          </div>
          <div className="mt-5 space-y-3">
            {completion.sections.map((section) => (
              <div key={section.key} className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
                <span>{section.label}</span>
                <span className={section.complete ? 'font-semibold text-emerald-700' : 'text-[var(--muted)]'}>
                  {section.complete ? 'Complete' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[28px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
            Resume step: {resumes.length ? `${resumes.length} resume(s) available.` : 'No resume uploaded yet.'}
            {' '}
            You can upload now or skip and come back later.
          </div>
        </Card>

        <Card className="rounded-[32px] p-6">
          <form action={submitCandidateOnboardingAction} className="grid gap-5">
            <input type="hidden" name="currentStep" value={onboarding.currentStep || 1} />
            <div className="grid gap-4 md:grid-cols-2">
              <input name="fullName" defaultValue={profile.fullName || ''} placeholder="Full name" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
              <input name="phoneNumber" defaultValue={profile.phoneNumber || ''} placeholder="Phone number" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
              <input name="location" defaultValue={profile.location || ''} placeholder="Current location" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
              <input name="currentTitle" defaultValue={profile.currentTitle || ''} placeholder="Professional title" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
              <input name="totalExperience" type="number" min="0" defaultValue={profile.totalExperience || 0} placeholder="Total experience" className="rounded-2xl border border-[var(--line)] px-4 py-3" required />
              <select name="employmentStatus" defaultValue={profile.employmentStatus || 'EMPLOYED'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option value="EMPLOYED">Employed</option>
                <option value="OPEN_TO_WORK">Open to work</option>
                <option value="UNEMPLOYED">Unemployed</option>
                <option value="STUDENT">Student</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="CAREER_BREAK">Career break</option>
              </select>
              <input name="primarySkills" defaultValue={(profile.skills || []).join(', ')} placeholder="Primary skills (comma separated)" className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" />
              <input name="preferredLocations" defaultValue={(profile.preferredLocations || []).join(', ')} placeholder="Preferred locations (comma separated)" className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" />
              <input name="noticePeriodDays" type="number" min="0" defaultValue={profile.noticePeriodDays || ''} placeholder="Notice period in days" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
              <select name="profileVisibility" defaultValue={profile.profileVisibility || 'PRIVATE'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option value="PRIVATE">Private</option>
                <option value="RECRUITERS_ONLY">Recruiters only</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-[var(--text)]">Work mode preference</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {['REMOTE', 'HYBRID', 'ONSITE'].map((value) => (
                  <label key={value} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                    <input type="checkbox" name="workplacePreferences" value={value} defaultChecked={(profile.workplacePreferences || []).includes(value)} />
                    <span>{value.replaceAll('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-[var(--text)]">Resume step</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                  <input type="radio" name="resumeStepAction" value="UNCHANGED" defaultChecked />
                  <span>Keep current resume status</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                  <input type="radio" name="resumeStepAction" value="SKIP" />
                  <span>Skip for now</span>
                </label>
              </div>
            </fieldset>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="searchableProfile" defaultChecked={profile.searchableProfile} />
              <span>Allow recruiters to discover my profile where Careeriz permissions allow it</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save onboarding progress</button>
              <Link href="/candidate/resumes" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">Upload resume</Link>
              <Link href="/candidate/dashboard" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">Open dashboard</Link>
            </div>
          </form>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
