'use client';

import { useActionState, useEffect, useRef } from 'react';
import { submitCandidateProfileFormAction } from '@/app/candidate/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormActions, FormSection } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

function fieldState(state, name) {
  const error = state.fieldErrors?.[name]?.[0];
  return {
    error,
  };
}

export function CandidateProfileForm({ profile }) {
  const [state, formAction, pending] = useActionState(submitCandidateProfileFormAction, initialState);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  const fullName = fieldState(state, 'fullName');
  const phoneNumber = fieldState(state, 'phoneNumber');
  const headline = fieldState(state, 'headline');
  const currentTitle = fieldState(state, 'currentTitle');
  const currentEmployer = fieldState(state, 'currentEmployer');
  const currentDesignation = fieldState(state, 'currentDesignation');
  const location = fieldState(state, 'location');
  const totalExperience = fieldState(state, 'totalExperience');
  const employmentStatus = fieldState(state, 'employmentStatus');
  const noticePeriodDays = fieldState(state, 'noticePeriodDays');
  const skills = fieldState(state, 'skills');
  const preferredRoles = fieldState(state, 'preferredRoles');
  const preferredLocations = fieldState(state, 'preferredLocations');
  const currentCtcLpa = fieldState(state, 'currentCtcLpa');
  const expectedCtcLpa = fieldState(state, 'expectedCtcLpa');
  const availability = fieldState(state, 'availability');
  const profileVisibility = fieldState(state, 'profileVisibility');
  const summary = fieldState(state, 'summary');
  const portfolioUrl = fieldState(state, 'portfolioUrl');
  const linkedInUrl = fieldState(state, 'linkedInUrl');
  const githubUrl = fieldState(state, 'githubUrl');
  const profileImageUrl = fieldState(state, 'profileImageUrl');
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state.status !== 'idle' ? (
        <Alert
          ref={summaryRef}
          tone={state.status === 'error' ? 'danger' : 'success'}
          title={state.status === 'error' ? 'Profile could not be saved' : 'Profile saved'}
          tabIndex={-1}
        >
          {state.message}
        </Alert>
      ) : null}

      <FormSection title="Core profile" description="Keep your public candidate record accurate for applications and recruiter discovery.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="fullName" label="Full name" required defaultValue={profile.fullName || ''} error={fullName.error} />
          <Input name="phoneNumber" label="Phone number" defaultValue={profile.phoneNumber || ''} error={phoneNumber.error} />
          <Input name="currentTitle" label="Current title" defaultValue={profile.currentTitle || ''} error={currentTitle.error} />
          <Input name="headline" label="Professional headline" defaultValue={profile.headline || ''} error={headline.error} />
          <Input name="location" label="Current location" defaultValue={profile.location || ''} error={location.error} />
          <Input name="currentEmployer" label="Current employer" defaultValue={profile.currentEmployer || ''} error={currentEmployer.error} />
          <Input name="currentDesignation" label="Current designation" defaultValue={profile.currentDesignation || ''} error={currentDesignation.error} />
          <Input name="totalExperience" label="Total experience (years)" type="number" min="0" defaultValue={profile.totalExperience || 0} error={totalExperience.error} />
          <Input name="noticePeriodDays" label="Notice period (days)" type="number" min="0" defaultValue={profile.noticePeriodDays || ''} error={noticePeriodDays.error} />
          <Select name="employmentStatus" label="Employment status" defaultValue={profile.employmentStatus || 'EMPLOYED'} error={employmentStatus.error}>
            <option value="EMPLOYED">Employed</option>
            <option value="OPEN_TO_WORK">Open to work</option>
            <option value="UNEMPLOYED">Unemployed</option>
            <option value="STUDENT">Student</option>
            <option value="FREELANCER">Freelancer</option>
            <option value="CAREER_BREAK">Career break</option>
          </Select>
          <Input name="lastWorkingDate" label="Last working date" type="date" defaultValue={profile.lastWorkingDate ? String(profile.lastWorkingDate).slice(0, 10) : ''} />
          <Input name="skills" label="Skills" defaultValue={(profile.skills || []).join(', ')} error={skills.error} className="md:col-span-2" />
          <Input name="preferredRoles" label="Preferred roles" defaultValue={(profile.preferredRoles || []).join(', ')} error={preferredRoles.error} />
          <Input name="preferredLocations" label="Preferred locations" defaultValue={(profile.preferredLocations || []).join(', ')} error={preferredLocations.error} />
          <Input name="currentCtcLpa" label="Current salary (LPA)" type="number" min="0" defaultValue={profile.currentCtcLpa || ''} error={currentCtcLpa.error} />
          <Input name="expectedCtcLpa" label="Expected salary (LPA)" type="number" min="0" defaultValue={profile.expectedCtcLpa || ''} error={expectedCtcLpa.error} />
          <Select name="availability" label="Availability" defaultValue={profile.availability || 'IMMEDIATE'} error={availability.error}>
            <option value="IMMEDIATE">Immediate</option>
            <option value="TWO_WEEKS">Two weeks</option>
            <option value="ONE_MONTH">One month</option>
            <option value="NOT_LOOKING">Not looking</option>
          </Select>
          <Select name="profileVisibility" label="Profile visibility" defaultValue={profile.profileVisibility || 'PRIVATE'} error={profileVisibility.error}>
            <option value="PRIVATE">Private</option>
            <option value="RECRUITERS_ONLY">Recruiters only</option>
            <option value="PUBLIC">Public</option>
          </Select>
        </div>
      </FormSection>

      <FormSection title="Preferences" description="Set how and where you want to work.">
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-[var(--color-text)]">Workplace preferences</legend>
          <div className="flex flex-wrap gap-4">
            {['REMOTE', 'HYBRID', 'ONSITE'].map((value) => (
              <Checkbox key={value} name="workplacePreferences" value={value} defaultChecked={(profile.workplacePreferences || []).includes(value)} label={value.replaceAll('_', ' ')} />
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-[var(--color-text)]">Employment preferences</legend>
          <div className="flex flex-wrap gap-4">
            {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((value) => (
              <Checkbox key={value} name="employmentPreferences" value={value} defaultChecked={(profile.employmentPreferences || []).includes(value)} label={value.replaceAll('_', ' ')} />
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Professional story" description="Share supporting links and a concise summary.">
        <Textarea name="summary" label="Professional summary" defaultValue={profile.summary || ''} rows={6} error={summary.error} />
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="portfolioUrl" label="Portfolio URL" defaultValue={profile.portfolioUrl || ''} error={portfolioUrl.error} />
          <Input name="linkedInUrl" label="LinkedIn URL" defaultValue={profile.linkedInUrl || ''} error={linkedInUrl.error} />
          <Input name="githubUrl" label="GitHub URL" defaultValue={profile.githubUrl || ''} error={githubUrl.error} />
          <Input name="profileImageUrl" label="Profile image URL" defaultValue={profile.profileImageUrl || ''} error={profileImageUrl.error} />
        </div>
      </FormSection>

      <FormSection title="Structured sections" description="These arrays are stored as structured JSON so Careeriz can preserve repeatable experience, education, skills, certifications, language, project, and link data.">
        <Textarea name="skillEntries" label="Skill entries (JSON array)" defaultValue={JSON.stringify(profile.skillEntries || [], null, 2)} rows={6} />
        <Textarea name="experienceEntries" label="Experience entries (JSON array)" defaultValue={JSON.stringify(profile.experienceEntries || [], null, 2)} rows={8} />
        <Textarea name="educationEntries" label="Education entries (JSON array)" defaultValue={JSON.stringify(profile.educationEntries || [], null, 2)} rows={8} />
        <Textarea name="certificationEntries" label="Certification entries (JSON array)" defaultValue={JSON.stringify(profile.certificationEntries || [], null, 2)} rows={6} />
        <Textarea name="languageEntries" label="Language entries (JSON array)" defaultValue={JSON.stringify(profile.languageEntries || [], null, 2)} rows={6} />
        <Textarea name="projectEntries" label="Project entries (JSON array)" defaultValue={JSON.stringify(profile.projectEntries || [], null, 2)} rows={8} />
        <Textarea name="portfolioLinks" label="Portfolio links (JSON array)" defaultValue={JSON.stringify(profile.portfolioLinks || [], null, 2)} rows={6} />
      </FormSection>

      <FormSection title="Privacy controls" description="Choose what recruiters can see when Careeriz permissions allow profile visibility.">
        <div className="grid gap-3">
          <Checkbox name="searchableProfile" defaultChecked={profile.searchableProfile} label="Allow profile discovery in eligible recruiter search flows" />
          <Checkbox name="phoneVisibleToRecruiters" defaultChecked={profile.phoneVisibleToRecruiters} label="Allow recruiters to see my phone number when they have valid access" />
          <Checkbox name="salaryVisibleToRecruiters" defaultChecked={profile.salaryVisibleToRecruiters} label="Allow recruiters to see my salary details when they have valid access" />
          <Checkbox name="resumeVisibleToRecruiters" defaultChecked={profile.resumeVisibleToRecruiters ?? true} label="Allow recruiters to view my resume when they have valid access" />
        </div>
      </FormSection>

      <FormActions>
        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? 'Saving profile...' : 'Save profile'}
        </Button>
      </FormActions>
    </form>
  );
}
