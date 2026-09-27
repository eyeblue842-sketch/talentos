"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkillsSelector } from '@/components/sections/job-post/skills-selector';
import { CandidateQualificationsFields } from '@/components/sections/job-post/candidate-qualifications-fields';
import { PreferredCandidateProfileAccordion } from '@/components/sections/job-post/preferred-candidate-profile-accordion';
import { JobLocationSelector, fromCanonicalLocations, toCanonicalLocations } from '@/components/sections/job-post/job-location-selector';
import { ApplicationRecipients } from '@/components/sections/job-post/application-recipients';

function toDateTimeLocal(value) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

/**
 * Client-side edit-job form. Rendering the SAME structured field components the
 * create wizard uses keeps a plain "Save changes" from silently nulling out
 * existing structured data. The fields are grouped into stages (Job details /
 * Candidate requirements / Walk-in / Job description) for the same low-clutter,
 * stage-wise experience as the create wizard - it stays ONE <form>, so every
 * stage's inputs submit together; the stage tabs only show/hide, they never
 * remove fields from the DOM.
 */
export function RecruiterJobEditForm({ job, assignees = [], updateJobAction }) {
  const [skills, setSkills] = useState(job.skillsRequired || []);
  const [locations, setLocations] = useState(() => (
    job.locations?.length ? fromCanonicalLocations(job.locations) : (job.location ? [job.location] : [])
  ));
  const [locationError, setLocationError] = useState('');
  const [experienceMin, setExperienceMin] = useState(String(job.experienceMin ?? ''));
  const [experienceMax, setExperienceMax] = useState(String(job.experienceMax ?? ''));
  const [department, setDepartment] = useState(job.department || '');
  const [workplaceType, setWorkplaceType] = useState(job.workplaceType || '');
  const [activeStage, setActiveStage] = useState('details');
  const [isWalkIn, setIsWalkIn] = useState(Boolean(job.isWalkIn));
  const [walkIn, setWalkIn] = useState(() => ({
    walkInStartDate: job.walkInStartDate ? String(job.walkInStartDate).slice(0, 10) : '',
    walkInEndDate: job.walkInEndDate ? String(job.walkInEndDate).slice(0, 10) : '',
    walkInTiming: job.walkInTiming || '',
    walkInContactName: job.walkInContactName || '',
    walkInContactPhone: job.walkInContactPhone || '',
    walkInVenueAddress: job.walkInVenueAddress || '',
    walkInGoogleMapsUrl: job.walkInGoogleMapsUrl || '',
  }));
  const [candidateQualifications, setCandidateQualifications] = useState(() => ({
    minimumQualification: '',
    educationCourse: '',
    specialization: '',
    specializationOther: '',
    relevantExperience: '',
    industry: '',
    role: '',
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

  const stages = useMemo(() => ([
    { id: 'details', label: 'Job details' },
    { id: 'requirements', label: 'Candidate requirements' },
    ...(isWalkIn ? [{ id: 'walkin', label: 'Walk-in & contact' }] : []),
    { id: 'description', label: 'Job description' },
  ]), [isWalkIn]);

  function setWalkInField(field, value) {
    setWalkIn((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    if (locationRequired && locations.length === 0) {
      event.preventDefault();
      setActiveStage('details');
      setLocationError('Add at least one job location for on-site or hybrid roles.');
    } else {
      setLocationError('');
    }
  }

  return (
    <Card className="grid gap-5">
      <div>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Edit job</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Edit stage by stage. Screening questions are managed in their own tab below.</p>
      </div>

      <ol className="flex flex-wrap gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-2 sm:gap-2" aria-label="Edit stages">
        {stages.map((stage, index) => {
          const active = activeStage === stage.id;
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => setActiveStage(stage.id)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold ${active ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'}`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">{index + 1}</span>
                {stage.label}
              </button>
            </li>
          );
        })}
      </ol>

      <form action={updateJobAction} onSubmit={handleSubmit} className="grid gap-4">
        <input type="hidden" name="skillsRequired" value={skills.join(', ')} />
        <input type="hidden" name="location" value={locations.join(', ') || (workplaceType === 'REMOTE' ? 'Remote' : '')} />
        <input type="hidden" name="locationsJson" value={JSON.stringify(toCanonicalLocations(locations))} />
        <input type="hidden" name="candidateQualificationsJson" value={JSON.stringify(candidateQualifications)} />
        <input type="hidden" name="preferredCandidateProfileJson" value={JSON.stringify(preferredCandidateProfile)} />
        {/* Job.requirements (legacy free-text list) has no surviving UI here -
            passed through unedited so saving never silently deletes it. */}
        <input type="hidden" name="requirements" value={(job.requirements || []).join('\n')} />
        <input type="hidden" name="isWalkIn" value={isWalkIn ? 'on' : ''} />
        <input type="hidden" name="walkInStartDate" value={walkIn.walkInStartDate} />
        <input type="hidden" name="walkInEndDate" value={walkIn.walkInEndDate} />
        <input type="hidden" name="walkInTiming" value={walkIn.walkInTiming} />
        <input type="hidden" name="walkInContactName" value={walkIn.walkInContactName} />
        <input type="hidden" name="walkInContactPhone" value={walkIn.walkInContactPhone} />
        <input type="hidden" name="walkInVenueAddress" value={walkIn.walkInVenueAddress} />
        <input type="hidden" name="walkInGoogleMapsUrl" value={walkIn.walkInGoogleMapsUrl} />

        {/* Stage 1 - Job details */}
        <div className={activeStage === 'details' ? 'grid gap-4' : 'hidden'}>
          <div className="grid items-start gap-4 md:grid-cols-2">
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
            <Input label="Minimum salary" name="salaryMin" type="number" min="0" defaultValue={job.salaryMin ?? ''} required />
            <Input label="Maximum salary" name="salaryMax" type="number" min="0" defaultValue={job.salaryMax ?? ''} required />
            <Select label="Currency" name="currency" defaultValue={job.currency || 'INR'}>
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="AED">AED - UAE Dirham</option>
              <option value="SGD">SGD - Singapore Dollar</option>
            </Select>
            <Input label="Openings" name="numberOfOpenings" type="number" min="1" defaultValue={job.numberOfOpenings || 1} />
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
            <Input label="Target hires" name="targetHires" type="number" min="1" defaultValue={job.targetHires ?? ''} />
            <ApplicationRecipients
              members={assignees}
              defaultPrimary={job.applicationNotificationEmail || ''}
              defaultAdditional={job.applicationNotificationEmails || []}
            />
          </div>

          <div>
            <JobLocationSelector values={locations} onChange={(next) => { setLocations(next); setLocationError(''); }} required={locationRequired} />
            {locationError ? <p className="mt-1.5 text-sm text-[var(--color-danger)]">{locationError}</p> : null}
          </div>

          <div className="grid gap-2.5">
            <span className="text-sm font-semibold text-[var(--color-text)]">Is this a walk-in job?</span>
            <div className="inline-flex w-fit rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-1">
              <button type="button" onClick={() => setIsWalkIn(true)} className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold ${isWalkIn ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>Yes</button>
              <button type="button" onClick={() => setIsWalkIn(false)} className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold ${!isWalkIn ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>No</button>
            </div>
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
        </div>

        {/* Stage 2 - Candidate requirements */}
        <div className={activeStage === 'requirements' ? 'grid gap-4' : 'hidden'}>
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
        </div>

        {/* Stage 3 - Walk-in & contact (only when walk-in) */}
        {isWalkIn ? (
          <div className={activeStage === 'walkin' ? 'grid gap-4' : 'hidden'}>
            <div className="grid items-start gap-4 md:grid-cols-2">
              <Input label="Walk-in start date" type="date" value={walkIn.walkInStartDate} onChange={(event) => setWalkInField('walkInStartDate', event.target.value)} />
              <Input label="Walk-in end date" type="date" value={walkIn.walkInEndDate} onChange={(event) => setWalkInField('walkInEndDate', event.target.value)} />
              <Input label="Walk-in timing" value={walkIn.walkInTiming} onChange={(event) => setWalkInField('walkInTiming', event.target.value)} placeholder="e.g. 9:30 AM - 5:30 PM" />
              <Input label="Contact name" value={walkIn.walkInContactName} onChange={(event) => setWalkInField('walkInContactName', event.target.value)} placeholder="Recruiter name (optional)" />
              <Input label="Contact mobile number" value={walkIn.walkInContactPhone} onChange={(event) => setWalkInField('walkInContactPhone', event.target.value)} helpText="Visible to candidates." />
              <Input label="Google Maps URL" value={walkIn.walkInGoogleMapsUrl} onChange={(event) => setWalkInField('walkInGoogleMapsUrl', event.target.value)} placeholder="https://maps.google.com/..." />
              <label className="md:col-span-2 grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Venue address</span>
                <textarea value={walkIn.walkInVenueAddress} onChange={(event) => setWalkInField('walkInVenueAddress', event.target.value)} rows={3} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" placeholder="Venue address candidates should come to" />
              </label>
            </div>
          </div>
        ) : null}

        {/* Stage 4 - Job description */}
        <div className={activeStage === 'description' ? 'grid gap-4' : 'hidden'}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">Job summary</span>
            <textarea name="description" defaultValue={job.description} rows={8} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" required />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">Key responsibilities</span>
            <textarea name="responsibilities" defaultValue={(job.responsibilities || []).join('\n')} rows={6} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">Perks &amp; benefits</span>
            <textarea name="benefits" defaultValue={(job.benefits || []).join('\n')} rows={5} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" />
          </label>
        </div>

        <Button type="submit" className="justify-self-start">Save changes</Button>
      </form>
    </Card>
  );
}
