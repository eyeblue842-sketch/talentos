"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkillsSelector } from '@/components/sections/job-post/skills-selector';
import { CandidateQualificationsFields } from '@/components/sections/job-post/candidate-qualifications-fields';
import { PreferredCandidateProfileAccordion } from '@/components/sections/job-post/preferred-candidate-profile-accordion';
import { JobLocationSelector, fromCanonicalLocations, toCanonicalLocations } from '@/components/sections/job-post/job-location-selector';

function toDateTimeLocal(value) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

/**
 * Client-side edit-job form. Rendering the SAME structured field
 * components the create wizard uses (SkillsSelector, Candidate
 * Qualifications, Preferred Candidate Profile, Job Location) - rather than
 * the plain hidden-passthrough fields a purely server-rendered form would
 * need - is what keeps a plain "Save changes" from silently nulling out
 * existing structured data: every field this job already has gets a real,
 * pre-filled control here, not just create-time-only inputs.
 */
export function RecruiterJobEditForm({ job, assignees = [], requisitions = [], updateJobAction }) {
  const [skills, setSkills] = useState(job.skillsRequired || []);
  const [locations, setLocations] = useState(() => (
    job.locations?.length ? fromCanonicalLocations(job.locations) : (job.location ? [job.location] : [])
  ));
  const [locationError, setLocationError] = useState('');
  const [experienceMin, setExperienceMin] = useState(String(job.experienceMin ?? ''));
  const [experienceMax, setExperienceMax] = useState(String(job.experienceMax ?? ''));
  const [department, setDepartment] = useState(job.department || '');
  const [workplaceType, setWorkplaceType] = useState(job.workplaceType || '');
  const [candidateQualifications, setCandidateQualifications] = useState(() => ({
    minimumQualification: '',
    educationCourse: '',
    specialization: '',
    relevantExperience: '',
    industry: '',
    noticePeriod: '',
    certifications: [],
    ...(job.candidateQualifications || {}),
  }));
  const [preferredCandidateProfile, setPreferredCandidateProfile] = useState(() => ({
    preferredExperience: '',
    preferredIndustry: '',
    preferredDepartmentRole: '',
    preferredEducation: '',
    preferredNoticePeriod: '',
    preferredCurrentLocation: '',
    willingToRelocate: '',
    workAuthorization: '',
    preferredCertifications: [],
    additionalNotes: '',
    ...(job.preferredCandidateProfile || {}),
  }));

  const locationRequired = workplaceType !== 'REMOTE';

  function handleSubmit(event) {
    if (locationRequired && locations.length === 0) {
      event.preventDefault();
      setLocationError('Add at least one job location for on-site or hybrid roles.');
    } else {
      setLocationError('');
    }
  }

  return (
    <Card>
      <h2 className="font-[var(--font-display)] text-2xl font-semibold">Edit job</h2>
      <form action={updateJobAction} onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <input type="hidden" name="skillsRequired" value={skills.join(', ')} />
        <input type="hidden" name="location" value={locations.join(', ') || (workplaceType === 'REMOTE' ? 'Remote' : '')} />
        <input type="hidden" name="locationsJson" value={JSON.stringify(toCanonicalLocations(locations))} />
        <input type="hidden" name="candidateQualificationsJson" value={JSON.stringify(candidateQualifications)} />
        <input type="hidden" name="preferredCandidateProfileJson" value={JSON.stringify(preferredCandidateProfile)} />
        {/* Job.requirements (legacy free-text "Candidate qualifications" list
            from the removed Candidate Preferences step) has no surviving UI
            in this redesign - Candidate Qualifications below is its
            structured replacement for new edits. Passed through unedited so
            saving this form never silently deletes it. */}
        <input type="hidden" name="requirements" value={(job.requirements || []).join('\n')} />

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Job title" name="title" defaultValue={job.title} required />
          <Select label="Employment type" name="employmentType" defaultValue={job.employmentType}>
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </Select>
          <Select label="Workplace" name="workplaceType" value={workplaceType} onChange={(event) => setWorkplaceType(event.target.value)}>
            <option value="">Workplace type</option>
            <option value="ONSITE">Onsite</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
          </Select>
          <Select label="Recruiter owner" name="recruiterId" defaultValue={job.recruiter?.id || ''}>
            <option value="">Recruiter owner</option>
            {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
          </Select>
          <Select label="Hiring manager" name="hiringManagerId" defaultValue={job.hiringManager?.id || ''}>
            <option value="">Hiring manager</option>
            {assignees.map((member) => <option key={member.id} value={member.userId}>{member.user?.email}</option>)}
          </Select>
          <Select label="Approved requisition" name="requisitionId" defaultValue={job.requisition?.id || ''}>
            <option value="">Approved requisition</option>
            {requisitions.map((requisition) => <option key={requisition.id} value={requisition.id}>{requisition.requisitionCode} - {requisition.title}</option>)}
          </Select>
          <Input label="Minimum salary" name="salaryMin" type="number" min="0" defaultValue={job.salaryMin ?? ''} required />
          <Input label="Maximum salary" name="salaryMax" type="number" min="0" defaultValue={job.salaryMax ?? ''} required />
          <Input label="Currency" name="currency" defaultValue={job.currency || ''} />
          <Input label="Openings" name="numberOfOpenings" type="number" min="1" defaultValue={job.numberOfOpenings || 1} />
          <Input label="Business unit" name="businessUnit" defaultValue={job.businessUnit || ''} />
          <Select label="Status" name="status" defaultValue={job.status}>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ON_HOLD">On hold</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Select label="Visibility" name="visibility" defaultValue={job.visibility || 'EXTERNAL'}>
            <option value="EXTERNAL">External visibility</option>
            <option value="INTERNAL">Internal visibility</option>
            <option value="BOTH">Both</option>
          </Select>
          <Input label="Application deadline" name="applicationDeadline" type="datetime-local" defaultValue={toDateTimeLocal(job.applicationDeadline)} />
          <Input label="Applications open from" name="applicationOpensAt" type="datetime-local" defaultValue={toDateTimeLocal(job.applicationOpensAt)} />
          <Input label="Applications close on" name="applicationClosesAt" type="datetime-local" defaultValue={toDateTimeLocal(job.applicationClosesAt)} />
          <Input label="Max applications" name="maxApplications" type="number" min="1" defaultValue={job.maxApplications ?? ''} />
          <Input label="Target hires" name="targetHires" type="number" min="1" defaultValue={job.targetHires ?? ''} />
          <Input
            label="Application notification email"
            name="applicationNotificationEmail"
            type="email"
            defaultValue={job.applicationNotificationEmail || ''}
            helpText="New application notifications will be sent to this email."
          />
        </div>

        <div>
          <JobLocationSelector values={locations} onChange={(next) => { setLocations(next); setLocationError(''); }} required={locationRequired} />
          {locationError ? <p className="mt-1.5 text-sm text-[var(--color-danger)]">{locationError}</p> : null}
        </div>

        <div className="grid gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input name="isPublic" type="checkbox" defaultChecked={job.isPublic} /> Public job page
          </label>
          <label className="flex items-center gap-2" title="Salary stays required internally for matching and hiring intelligence; this only controls the public/candidate-facing job page.">
            <input name="hideSalaryFromCandidates" type="checkbox" defaultChecked={!job.publicSalaryEnabled} /> Hide salary from candidates
            {!job.publicSalaryEnabled ? <span className="text-xs font-semibold text-amber-600">Salary hidden from candidates</span> : null}
          </label>
          <label className="flex items-center gap-2">
            <input name="featuredInPortal" type="checkbox" defaultChecked={job.featuredInPortal} /> Feature on portal
          </label>
          <label className="flex items-center gap-2">
            <input name="autoCloseOnTargetHire" type="checkbox" defaultChecked={job.autoCloseOnTargetHire} /> Auto-close on target hires
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Job summary</span>
          <textarea name="description" defaultValue={job.description} rows={8} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Key responsibilities</span>
          <textarea name="responsibilities" defaultValue={(job.responsibilities || []).join('\n')} rows={6} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">Perks & benefits</span>
          <textarea name="benefits" defaultValue={(job.benefits || []).join('\n')} rows={5} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" />
        </label>

        <Card>
          <SkillsSelector label="Add skills" value={skills} onChange={setSkills} required />
        </Card>

        <CandidateQualificationsFields
          experienceMin={experienceMin}
          experienceMax={experienceMax}
          onExperienceMinChange={setExperienceMin}
          onExperienceMaxChange={setExperienceMax}
          department={department}
          onDepartmentChange={setDepartment}
          value={candidateQualifications}
          onChange={setCandidateQualifications}
        />

        <PreferredCandidateProfileAccordion value={preferredCandidateProfile} onChange={setPreferredCandidateProfile} />

        <Button type="submit" className="justify-self-start">Save changes</Button>
      </form>
    </Card>
  );
}
