'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitCandidateProfileFormAction } from '@/app/candidate/actions';
import { Alert } from '@/components/ui/alert';
import { CandidateAvatar } from '@/components/ui/candidate-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  PROFILE_PHOTO_ACCEPT,
  resolveCandidateProfilePhotoSrc,
  validateCandidateProfilePhotoSelection,
} from '@/lib/candidate-profile-photo';
import {
  deriveCtcEditorValue,
  formatCandidateAnnualCtc,
  getCtcFieldErrorMessage,
  normalizeCtcToLpa,
} from '@/lib/ctc';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

const languageOptions = [
  'Arabic', 'Bengali', 'Chinese', 'Dutch', 'English', 'French', 'German', 'Gujarati', 'Hindi', 'Italian',
  'Japanese', 'Kannada', 'Malayalam', 'Mandarin', 'Marathi', 'Portuguese', 'Punjabi', 'Spanish', 'Tamil', 'Telugu', 'Urdu',
];

const proficiencyOptions = ['Beginner', 'Elementary', 'Conversational', 'Professional Working', 'Proficient', 'Fluent', 'Native / Bilingual'];
const workplacePreferenceOptions = ['REMOTE', 'HYBRID', 'ONSITE'];
const employmentPreferenceOptions = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const ctcUnitOptions = [
  { value: 'LAKH_PER_ANNUM', label: 'Lakh per annum' },
  { value: 'CRORE_PER_ANNUM', label: 'Crore per annum' },
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeStringArray(value) {
  return ensureArray(value).map((item) => normalizeText(item)).filter(Boolean);
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return normalizeText(value).length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (typeof value === 'object') return Object.values(value).some((item) => hasMeaningfulValue(item));
  return Boolean(value);
}

function serializeStructuredArray(entries) {
  return JSON.stringify(ensureArray(entries).filter((entry) => hasMeaningfulValue(entry)));
}

function createExperienceEntry(entry = {}) {
  return {
    company: entry.company || '',
    title: entry.title || entry.jobTitle || entry.designation || '',
    employmentType: entry.employmentType || '',
    startDate: entry.startDate || '',
    endDate: entry.endDate || '',
    currentlyWorking: Boolean(entry.currentlyWorking || entry.isCurrent),
    location: entry.location || '',
    summary: entry.summary || entry.description || '',
    technologies: normalizeStringArray(entry.technologies || entry.skills),
  };
}

function createEducationEntry(entry = {}) {
  return {
    degree: entry.degree || '',
    institution: entry.institution || '',
    fieldOfStudy: entry.fieldOfStudy || entry.specialization || '',
    startYear: entry.startYear || '',
    endYear: entry.endYear || entry.year || '',
    score: entry.score || '',
    educationType: entry.educationType || '',
  };
}

function createCertificationEntry(entry = {}) {
  return {
    name: entry.name || '',
    issuingOrganisation: entry.issuingOrganisation || '',
    issueDate: entry.issueDate || '',
    expiryDate: entry.expiryDate || '',
    credentialUrl: entry.credentialUrl || '',
    credentialId: entry.credentialId || '',
  };
}

function createLanguageEntry(entry = {}) {
  return {
    language: entry.language || entry.name || '',
    proficiency: entry.proficiency || '',
    read: Boolean(entry.read),
    write: Boolean(entry.write),
    speak: entry.speak === undefined ? true : Boolean(entry.speak),
  };
}

function createProjectEntry(entry = {}) {
  return {
    projectName: entry.projectName || entry.name || entry.title || '',
    role: entry.role || '',
    company: entry.company || entry.client || '',
    startDate: entry.startDate || '',
    endDate: entry.endDate || '',
    duration: entry.duration || '',
    domain: entry.domain || '',
    technologies: normalizeStringArray(entry.technologies || entry.skills),
    summary: entry.summary || entry.description || '',
  };
}

function fieldState(state, name) {
  const error = state.fieldErrors?.[name]?.[0];
  return { error };
}

function updateListItem(setter, index, field, value) {
  setter((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
}

function addListItem(setter, createEntry) {
  setter((current) => [...current, createEntry()]);
}

function removeListItem(setter, index) {
  setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
}

function formatDate(value) {
  if (!value) return 'Not added';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
  return value;
}

function commaSeparatedValue(values) {
  return ensureArray(values).join(', ');
}

function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/70 px-5 py-6 text-sm text-[var(--color-text-muted)]">
      <p>{message}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function TagList({ items }) {
  if (!items.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">Nothing added yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-[var(--soft)] px-3 py-1 text-sm font-medium text-[var(--brand)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function StructuredPreviewCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
      <p className="font-semibold text-[var(--color-text)]">{title}</p>
      <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">{children}</div>
    </div>
  );
}

function SectionCard({ id, title, description, actionLabel = 'Edit', onAction, children }) {
  return (
    <Card id={id} className="scroll-mt-24 rounded-[32px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
        <Button type="button" variant="outline" onClick={onAction}>{actionLabel}</Button>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function StructuredEditorCard({ title, children, onRemove, removeLabel = 'Remove' }) {
  return (
    <div className="grid gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
        <Button type="button" variant="ghost" onClick={onRemove}>{removeLabel}</Button>
      </div>
      {children}
    </div>
  );
}

function CtcInputGroup({ amountLabel, amountValue, unitValue, onAmountChange, onUnitChange, error, helperText }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-[var(--color-text)]">{amountLabel}</p>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={amountValue}
          onChange={onAmountChange}
          error={error}
        />
        <Select label="Unit" value={unitValue} onChange={onUnitChange}>
          {ctcUnitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">{helperText}</p>
    </div>
  );
}

function readOnlyValue(value, fallback = 'Not added') {
  return hasMeaningfulValue(value) ? String(value) : fallback;
}

function CollapsibleSummary({ value }) {
  const [expanded, setExpanded] = useState(false);
  const text = readOnlyValue(value);
  const shouldCollapse = text !== 'Not added' && text.length > 180;

  return (
    <div className="rounded-2xl border border-[var(--line)] p-4">
      <p className={expanded || !shouldCollapse ? 'text-sm text-[var(--color-text)]' : 'line-clamp-4 text-sm text-[var(--color-text)]'}>
        {text}
      </p>
      {shouldCollapse ? (
        <Button type="button" variant="ghost" className="mt-3 px-0 text-sm" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Show less' : 'Read more'}
        </Button>
      ) : null}
    </div>
  );
}

function buildValues(profile) {
  return {
    fullName: profile.fullName || '',
    phoneNumber: profile.phoneNumber || '',
    currentTitle: profile.currentTitle || '',
    headline: profile.headline || '',
    location: profile.location || '',
    currentEmployer: profile.currentEmployer || '',
    currentDesignation: profile.currentDesignation || '',
    totalExperience: profile.totalExperience || 0,
    noticePeriodDays: profile.noticePeriodDays || '',
    employmentStatus: profile.employmentStatus || 'EMPLOYED',
    lastWorkingDate: profile.lastWorkingDate ? String(profile.lastWorkingDate).slice(0, 10) : '',
    preferredRoles: commaSeparatedValue(profile.preferredRoles),
    preferredLocations: commaSeparatedValue(profile.preferredLocations),
    availability: profile.availability || 'IMMEDIATE',
    profileVisibility: profile.profileVisibility || 'PRIVATE',
    summary: profile.summary || '',
    portfolioUrl: profile.portfolioUrl || '',
    linkedInUrl: profile.linkedInUrl || '',
    githubUrl: profile.githubUrl || '',
  };
}

function buildCtcValues(profile) {
  return {
    current: deriveCtcEditorValue(profile.currentCtcLpa),
    expected: deriveCtcEditorValue(profile.expectedCtcLpa),
  };
}

function buildPrivacy(profile) {
  return {
    searchableProfile: Boolean(profile.searchableProfile),
    phoneVisibleToRecruiters: Boolean(profile.phoneVisibleToRecruiters),
    salaryVisibleToRecruiters: Boolean(profile.salaryVisibleToRecruiters),
    resumeVisibleToRecruiters: profile.resumeVisibleToRecruiters !== false,
  };
}

function buildProfilePhotoState(profile) {
  return {
    action: 'keep',
    error: '',
    selectedFile: null,
    previewUrl: null,
    currentPhotoSrc: resolveCandidateProfilePhotoSrc(profile.profileImageUrl, profile.updatedAt),
  };
}

export function CandidateProfileForm({ profile, activeSection: controlledActiveSection, onActiveSectionChange }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitCandidateProfileFormAction, initialState);
  const summaryRef = useRef(null);
  const profilePhotoInputRef = useRef(null);
  const formId = 'candidate-profile-form';
  const [uncontrolledActiveSection, setUncontrolledActiveSection] = useState(null);
  const activeSection = controlledActiveSection ?? uncontrolledActiveSection;

  function setActiveSection(value) {
    onActiveSectionChange?.(value);
    if (controlledActiveSection === undefined) {
      setUncontrolledActiveSection(value);
    }
  }

  const [values, setValues] = useState(() => buildValues(profile));
  const [skillInput, setSkillInput] = useState(() => commaSeparatedValue(profile.skills));
  const [workplacePreferences, setWorkplacePreferences] = useState(() => ensureArray(profile.workplacePreferences));
  const [employmentPreferences, setEmploymentPreferences] = useState(() => ensureArray(profile.employmentPreferences));
  const [privacy, setPrivacy] = useState(() => buildPrivacy(profile));
  const [profilePhoto, setProfilePhoto] = useState(() => buildProfilePhotoState(profile));
  const [ctcValues, setCtcValues] = useState(() => buildCtcValues(profile));
  const [experienceEntries, setExperienceEntries] = useState(() => ensureArray(profile.experienceEntries).map(createExperienceEntry));
  const [educationEntries, setEducationEntries] = useState(() => ensureArray(profile.educationEntries).map(createEducationEntry));
  const [certificationEntries, setCertificationEntries] = useState(() => ensureArray(profile.certificationEntries).map(createCertificationEntry));
  const [languageEntries, setLanguageEntries] = useState(() => {
    const seeded = ensureArray(profile.languageEntries).map(createLanguageEntry);
    return seeded.length ? seeded : [createLanguageEntry()];
  });
  const [projectEntries, setProjectEntries] = useState(() => ensureArray(profile.projectEntries).map(createProjectEntry));

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
    if (state.status === 'success') {
      setActiveSection(null);
      router.refresh();
    }
  }, [router, state.status]);

  useEffect(() => {
    setValues(buildValues(profile));
    setSkillInput(commaSeparatedValue(profile.skills));
    setWorkplacePreferences(ensureArray(profile.workplacePreferences));
    setEmploymentPreferences(ensureArray(profile.employmentPreferences));
    setPrivacy(buildPrivacy(profile));
    setProfilePhoto(buildProfilePhotoState(profile));
    setCtcValues(buildCtcValues(profile));
    setExperienceEntries(ensureArray(profile.experienceEntries).map(createExperienceEntry));
    setEducationEntries(ensureArray(profile.educationEntries).map(createEducationEntry));
    setCertificationEntries(ensureArray(profile.certificationEntries).map(createCertificationEntry));
    setLanguageEntries(() => {
      const seeded = ensureArray(profile.languageEntries).map(createLanguageEntry);
      return seeded.length ? seeded : [createLanguageEntry()];
    });
    setProjectEntries(ensureArray(profile.projectEntries).map(createProjectEntry));
  }, [profile]);

  const skills = useMemo(() => normalizeStringArray(skillInput.split(',')), [skillInput]);

  const errors = useMemo(() => ({
    fullName: fieldState(state, 'fullName'),
    phoneNumber: fieldState(state, 'phoneNumber'),
    headline: fieldState(state, 'headline'),
    currentTitle: fieldState(state, 'currentTitle'),
    currentEmployer: fieldState(state, 'currentEmployer'),
    currentDesignation: fieldState(state, 'currentDesignation'),
    location: fieldState(state, 'location'),
    totalExperience: fieldState(state, 'totalExperience'),
    noticePeriodDays: fieldState(state, 'noticePeriodDays'),
    lastWorkingDate: fieldState(state, 'lastWorkingDate'),
    currentCtcLpa: fieldState(state, 'currentCtcLpa'),
    expectedCtcLpa: fieldState(state, 'expectedCtcLpa'),
    summary: fieldState(state, 'summary'),
    portfolioUrl: fieldState(state, 'portfolioUrl'),
    linkedInUrl: fieldState(state, 'linkedInUrl'),
    githubUrl: fieldState(state, 'githubUrl'),
    skills: fieldState(state, 'skills'),
    preferredRoles: fieldState(state, 'preferredRoles'),
    preferredLocations: fieldState(state, 'preferredLocations'),
    availability: fieldState(state, 'availability'),
  }), [state]);

  const sectionLabels = {
    'profile-snapshot': 'Profile snapshot',
    'resume-headline': 'Resume headline',
    'key-skills': 'Key skills',
    employment: 'Employment',
    education: 'Education',
    projects: 'Projects',
    'profile-summary': 'Profile summary',
    certifications: 'Certifications',
    'career-profile': 'Career profile',
    'personal-details': 'Personal details',
    privacy: 'Privacy',
  };

  function toggleSelection(valuesList, value) {
    return valuesList.includes(value)
      ? valuesList.filter((item) => item !== value)
      : [...valuesList, value];
  }

  function updateValue(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateCtcValue(field, key, nextValue) {
    setCtcValues((current) => ({
      ...current,
      [field]: {
        ...current[field],
        [key]: nextValue,
      },
    }));
  }

  const normalizedCurrentCtcLpa = normalizeCtcToLpa(ctcValues.current.amount, ctcValues.current.unit);
  const normalizedExpectedCtcLpa = normalizeCtcToLpa(ctcValues.expected.amount, ctcValues.expected.unit);

  function handleProfilePhotoChange(event) {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setProfilePhoto((current) => ({ ...current, error: '' }));
      return;
    }

    const validationError = validateCandidateProfilePhotoSelection(nextFile);
    if (validationError) {
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = '';
      }
      setProfilePhoto((current) => ({
        ...current,
        action: current.currentPhotoSrc ? 'keep' : 'keep',
        error: validationError,
        selectedFile: null,
        previewUrl: null,
      }));
      return;
    }

    const previewUrl = URL.createObjectURL(nextFile);
    setProfilePhoto((current) => {
      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return {
        ...current,
        action: 'upload',
        error: '',
        selectedFile: nextFile,
        previewUrl,
      };
    });
  }

  function handleRemoveProfilePhoto() {
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = '';
    }
    setProfilePhoto((current) => {
      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return {
        ...current,
        action: current.currentPhotoSrc ? 'remove' : 'keep',
        error: '',
        selectedFile: null,
        previewUrl: null,
      };
    });
  }

  useEffect(() => () => {
    if (profilePhoto.previewUrl) {
      URL.revokeObjectURL(profilePhoto.previewUrl);
    }
  }, [profilePhoto.previewUrl]);

  function renderEditor() {
    if (!activeSection) return null;

    switch (activeSection) {
      case 'profile-snapshot':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">Profile photo</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <CandidateAvatar
                  src={profilePhoto.previewUrl || (profilePhoto.action === 'remove' ? null : profilePhoto.currentPhotoSrc)}
                  name={values.fullName}
                  alt={`${values.fullName || 'Candidate'} profile photo preview`}
                  sizeClassName="h-24 w-24"
                />
                <div className="flex flex-col gap-3">
                  <input
                    ref={profilePhotoInputRef}
                    type="file"
                    name="profilePhoto"
                    accept={PROFILE_PHOTO_ACCEPT}
                    aria-label="Upload profile photo"
                    className="sr-only"
                    onChange={handleProfilePhotoChange}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" onClick={() => profilePhotoInputRef.current?.click()}>
                      {profilePhoto.previewUrl || profilePhoto.currentPhotoSrc ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {(profilePhoto.previewUrl || profilePhoto.currentPhotoSrc) ? (
                      <Button type="button" variant="outline" onClick={handleRemoveProfilePhoto}>
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">JPG, PNG, or WebP up to 5 MB.</p>
                  {profilePhoto.error ? <p className="text-sm text-red-600">{profilePhoto.error}</p> : null}
                </div>
              </div>
            </div>
            <Input label="Full name" value={values.fullName} onChange={(event) => updateValue('fullName', event.target.value)} error={errors.fullName.error} />
            <Input label="Phone number" value={values.phoneNumber} onChange={(event) => updateValue('phoneNumber', event.target.value)} error={errors.phoneNumber.error} />
            <Input label="Current title" value={values.currentTitle} onChange={(event) => updateValue('currentTitle', event.target.value)} error={errors.currentTitle.error} />
            <Input label="Current location" value={values.location} onChange={(event) => updateValue('location', event.target.value)} error={errors.location.error} />
            <Input label="Current employer" value={values.currentEmployer} onChange={(event) => updateValue('currentEmployer', event.target.value)} error={errors.currentEmployer.error} />
            <Input label="Current designation" value={values.currentDesignation} onChange={(event) => updateValue('currentDesignation', event.target.value)} error={errors.currentDesignation.error} />
            <Input label="Total experience (years)" type="number" min="0" value={values.totalExperience} onChange={(event) => updateValue('totalExperience', event.target.value)} error={errors.totalExperience.error} />
            <div className="md:col-span-2">
              <CtcInputGroup
                amountLabel="Current annual CTC"
                amountValue={ctcValues.current.amount}
                unitValue={ctcValues.current.unit}
                onAmountChange={(event) => updateCtcValue('current', 'amount', event.target.value)}
                onUnitChange={(event) => updateCtcValue('current', 'unit', event.target.value)}
                error={getCtcFieldErrorMessage(errors.currentCtcLpa.error, 'current annual CTC')}
                helperText="Enter your current annual package."
              />
            </div>
            <Input label="Notice period (days)" type="number" min="0" value={values.noticePeriodDays} onChange={(event) => updateValue('noticePeriodDays', event.target.value)} error={errors.noticePeriodDays.error} />
          </div>
        );
      case 'resume-headline':
        return (
          <div className="grid gap-4">
            <Textarea label="Resume headline" rows={4} value={values.headline} onChange={(event) => updateValue('headline', event.target.value)} error={errors.headline.error} />
          </div>
        );
      case 'key-skills':
        return (
          <Input
            label="Skills"
            helpText="Add skills as comma-separated values."
            value={skillInput}
            onChange={(event) => setSkillInput(event.target.value)}
            error={errors.skills.error}
          />
        );
      case 'employment':
        return (
          <div className="grid gap-4">
            {experienceEntries.map((entry, index) => (
              <StructuredEditorCard key={`experience-${index}`} title={`Employment ${index + 1}`} onRemove={() => removeListItem(setExperienceEntries, index)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Company" value={entry.company} onChange={(event) => updateListItem(setExperienceEntries, index, 'company', event.target.value)} />
                  <Input label="Job title / designation" value={entry.title} onChange={(event) => updateListItem(setExperienceEntries, index, 'title', event.target.value)} />
                  <Input label="Employment type" value={entry.employmentType} onChange={(event) => updateListItem(setExperienceEntries, index, 'employmentType', event.target.value)} />
                  <Input label="Location" value={entry.location} onChange={(event) => updateListItem(setExperienceEntries, index, 'location', event.target.value)} />
                  <Input label="Start date" value={entry.startDate} onChange={(event) => updateListItem(setExperienceEntries, index, 'startDate', event.target.value)} />
                  <Input label="End date" value={entry.endDate} disabled={entry.currentlyWorking} onChange={(event) => updateListItem(setExperienceEntries, index, 'endDate', event.target.value)} />
                  <Input label="Technologies / skills" value={commaSeparatedValue(entry.technologies)} onChange={(event) => updateListItem(setExperienceEntries, index, 'technologies', normalizeStringArray(event.target.value.split(',')))} className="md:col-span-2" />
                  <Checkbox label="Current role" checked={entry.currentlyWorking} onChange={(event) => updateListItem(setExperienceEntries, index, 'currentlyWorking', event.target.checked)} className="md:col-span-2" />
                  <Textarea label="Description / responsibilities" rows={4} value={entry.summary} onChange={(event) => updateListItem(setExperienceEntries, index, 'summary', event.target.value)} className="md:col-span-2" />
                </div>
              </StructuredEditorCard>
            ))}
            <Button type="button" variant="secondary" onClick={() => addListItem(setExperienceEntries, createExperienceEntry)}>+ Add Employment</Button>
          </div>
        );
      case 'education':
        return (
          <div className="grid gap-4">
            {educationEntries.map((entry, index) => (
              <StructuredEditorCard key={`education-${index}`} title={`Education ${index + 1}`} onRemove={() => removeListItem(setEducationEntries, index)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Degree" value={entry.degree} onChange={(event) => updateListItem(setEducationEntries, index, 'degree', event.target.value)} />
                  <Input label="Institution" value={entry.institution} onChange={(event) => updateListItem(setEducationEntries, index, 'institution', event.target.value)} />
                  <Input label="Field of study" value={entry.fieldOfStudy} onChange={(event) => updateListItem(setEducationEntries, index, 'fieldOfStudy', event.target.value)} />
                  <Input label="Education type" value={entry.educationType} onChange={(event) => updateListItem(setEducationEntries, index, 'educationType', event.target.value)} />
                  <Input label="Start year" value={entry.startYear} onChange={(event) => updateListItem(setEducationEntries, index, 'startYear', event.target.value)} />
                  <Input label="End year / year" value={entry.endYear} onChange={(event) => updateListItem(setEducationEntries, index, 'endYear', event.target.value)} />
                  <Input label="Score" value={entry.score} onChange={(event) => updateListItem(setEducationEntries, index, 'score', event.target.value)} className="md:col-span-2" />
                </div>
              </StructuredEditorCard>
            ))}
            <Button type="button" variant="secondary" onClick={() => addListItem(setEducationEntries, createEducationEntry)}>+ Add Education</Button>
          </div>
        );
      case 'projects':
        return (
          <div className="grid gap-4">
            {projectEntries.map((entry, index) => (
              <StructuredEditorCard key={`project-${index}`} title={`Project ${index + 1}`} onRemove={() => removeListItem(setProjectEntries, index)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Project name" value={entry.projectName} onChange={(event) => updateListItem(setProjectEntries, index, 'projectName', event.target.value)} />
                  <Input label="Role" value={entry.role} onChange={(event) => updateListItem(setProjectEntries, index, 'role', event.target.value)} />
                  <Input label="Company / client" value={entry.company} onChange={(event) => updateListItem(setProjectEntries, index, 'company', event.target.value)} />
                  <Input label="Duration" value={entry.duration} onChange={(event) => updateListItem(setProjectEntries, index, 'duration', event.target.value)} />
                  <Input label="Start date" value={entry.startDate} onChange={(event) => updateListItem(setProjectEntries, index, 'startDate', event.target.value)} />
                  <Input label="End date" value={entry.endDate} onChange={(event) => updateListItem(setProjectEntries, index, 'endDate', event.target.value)} />
                  <Input label="Domain" value={entry.domain} onChange={(event) => updateListItem(setProjectEntries, index, 'domain', event.target.value)} />
                  <Input label="Technologies" value={commaSeparatedValue(entry.technologies)} onChange={(event) => updateListItem(setProjectEntries, index, 'technologies', normalizeStringArray(event.target.value.split(',')))} />
                  <Textarea label="Description / responsibilities" rows={4} value={entry.summary} onChange={(event) => updateListItem(setProjectEntries, index, 'summary', event.target.value)} className="md:col-span-2" />
                </div>
              </StructuredEditorCard>
            ))}
            <Button type="button" variant="secondary" onClick={() => addListItem(setProjectEntries, createProjectEntry)}>+ Add Project</Button>
          </div>
        );
      case 'profile-summary':
        return (
          <div className="grid gap-4">
            <Textarea label="Professional summary" rows={6} value={values.summary} onChange={(event) => updateValue('summary', event.target.value)} error={errors.summary.error} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Portfolio URL" value={values.portfolioUrl} onChange={(event) => updateValue('portfolioUrl', event.target.value)} error={errors.portfolioUrl.error} />
              <Input label="LinkedIn URL" value={values.linkedInUrl} onChange={(event) => updateValue('linkedInUrl', event.target.value)} error={errors.linkedInUrl.error} />
              <Input label="GitHub URL" value={values.githubUrl} onChange={(event) => updateValue('githubUrl', event.target.value)} error={errors.githubUrl.error} />
            </div>
          </div>
        );
      case 'certifications':
        return (
          <div className="grid gap-4">
            {certificationEntries.map((entry, index) => (
              <StructuredEditorCard key={`certification-${index}`} title={`Certification ${index + 1}`} onRemove={() => removeListItem(setCertificationEntries, index)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Certification name" value={entry.name} onChange={(event) => updateListItem(setCertificationEntries, index, 'name', event.target.value)} />
                  <Input label="Issuing organisation" value={entry.issuingOrganisation} onChange={(event) => updateListItem(setCertificationEntries, index, 'issuingOrganisation', event.target.value)} />
                  <Input label="Issue date" value={entry.issueDate} onChange={(event) => updateListItem(setCertificationEntries, index, 'issueDate', event.target.value)} />
                  <Input label="Expiry date" value={entry.expiryDate} onChange={(event) => updateListItem(setCertificationEntries, index, 'expiryDate', event.target.value)} />
                  <Input label="Credential URL" value={entry.credentialUrl} onChange={(event) => updateListItem(setCertificationEntries, index, 'credentialUrl', event.target.value)} />
                  <Input label="Credential ID" value={entry.credentialId} onChange={(event) => updateListItem(setCertificationEntries, index, 'credentialId', event.target.value)} />
                </div>
              </StructuredEditorCard>
            ))}
            <Button type="button" variant="secondary" onClick={() => addListItem(setCertificationEntries, createCertificationEntry)}>+ Add Certification</Button>
          </div>
        );
      case 'career-profile':
        return (
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Preferred roles" value={values.preferredRoles} onChange={(event) => updateValue('preferredRoles', event.target.value)} error={errors.preferredRoles.error} />
              <Input label="Preferred locations" value={values.preferredLocations} onChange={(event) => updateValue('preferredLocations', event.target.value)} error={errors.preferredLocations.error} />
              <div className="md:col-span-2">
                <CtcInputGroup
                  amountLabel="Expected annual CTC"
                  amountValue={ctcValues.expected.amount}
                  unitValue={ctcValues.expected.unit}
                  onAmountChange={(event) => updateCtcValue('expected', 'amount', event.target.value)}
                  onUnitChange={(event) => updateCtcValue('expected', 'unit', event.target.value)}
                  error={getCtcFieldErrorMessage(errors.expectedCtcLpa.error, 'expected annual CTC')}
                  helperText="Enter your expected annual package."
                />
              </div>
              <Select label="Availability" value={values.availability} onChange={(event) => updateValue('availability', event.target.value)} error={errors.availability.error}>
                <option value="IMMEDIATE">Immediate</option>
                <option value="TWO_WEEKS">Two weeks</option>
                <option value="ONE_MONTH">One month</option>
                <option value="NOT_LOOKING">Not looking</option>
              </Select>
              <Select label="Employment status" value={values.employmentStatus} onChange={(event) => updateValue('employmentStatus', event.target.value)}>
                <option value="EMPLOYED">Employed</option>
                <option value="OPEN_TO_WORK">Open to work</option>
                <option value="UNEMPLOYED">Unemployed</option>
                <option value="STUDENT">Student</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="CAREER_BREAK">Career break</option>
              </Select>
              <Select label="Profile visibility" value={values.profileVisibility} onChange={(event) => updateValue('profileVisibility', event.target.value)}>
                <option value="PRIVATE">Private</option>
                <option value="RECRUITERS_ONLY">Recruiters only</option>
                <option value="PUBLIC">Public</option>
              </Select>
              <Input label="Notice period (days)" type="number" min="0" value={values.noticePeriodDays} onChange={(event) => updateValue('noticePeriodDays', event.target.value)} error={errors.noticePeriodDays.error} />
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Workplace preferences</p>
              <div className="flex flex-wrap gap-4">
                {workplacePreferenceOptions.map((option) => (
                  <Checkbox key={option} label={option.replaceAll('_', ' ')} checked={workplacePreferences.includes(option)} onChange={() => setWorkplacePreferences((current) => toggleSelection(current, option))} />
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Employment preferences</p>
              <div className="flex flex-wrap gap-4">
                {employmentPreferenceOptions.map((option) => (
                  <Checkbox key={option} label={option.replaceAll('_', ' ')} checked={employmentPreferences.includes(option)} onChange={() => setEmploymentPreferences((current) => toggleSelection(current, option))} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'personal-details':
        return (
          <div className="grid gap-4">
            {languageEntries.map((entry, index) => (
              <div key={`language-${index}`} className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <Select label="Language" value={entry.language} onChange={(event) => updateListItem(setLanguageEntries, index, 'language', event.target.value)}>
                  <option value="">Select language</option>
                  {languageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
                <Select label="Proficiency" value={entry.proficiency} onChange={(event) => updateListItem(setLanguageEntries, index, 'proficiency', event.target.value)}>
                  <option value="">Select proficiency</option>
                  {proficiencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </Select>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => addListItem(setLanguageEntries, createLanguageEntry)}>+ Add</Button>
                  {languageEntries.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove language ${entry.language || index + 1}`}
                      onClick={() => removeListItem(setLanguageEntries, index)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="md:col-span-3">
                  <div className="flex flex-wrap gap-4">
                    <Checkbox label="Read" checked={entry.read} onChange={(event) => updateListItem(setLanguageEntries, index, 'read', event.target.checked)} />
                    <Checkbox label="Write" checked={entry.write} onChange={(event) => updateListItem(setLanguageEntries, index, 'write', event.target.checked)} />
                    <Checkbox label="Speak" checked={entry.speak} onChange={(event) => updateListItem(setLanguageEntries, index, 'speak', event.target.checked)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 'privacy':
        return (
          <div className="grid gap-3">
            <Checkbox label="Allow profile discovery in eligible recruiter search flows" checked={privacy.searchableProfile} onChange={(event) => setPrivacy((current) => ({ ...current, searchableProfile: event.target.checked }))} />
            <Checkbox label="Allow recruiters to see my phone number when they have valid access" checked={privacy.phoneVisibleToRecruiters} onChange={(event) => setPrivacy((current) => ({ ...current, phoneVisibleToRecruiters: event.target.checked }))} />
            <Checkbox label="Allow recruiters to see my salary details when they have valid access" checked={privacy.salaryVisibleToRecruiters} onChange={(event) => setPrivacy((current) => ({ ...current, salaryVisibleToRecruiters: event.target.checked }))} />
            <Checkbox label="Allow recruiters to view my resume when they have valid access" checked={privacy.resumeVisibleToRecruiters} onChange={(event) => setPrivacy((current) => ({ ...current, resumeVisibleToRecruiters: event.target.checked }))} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <form id={formId} action={formAction} className="grid gap-6" noValidate>
      <input type="hidden" name="activeSection" value={activeSection || ''} />
      <input type="hidden" name="fullName" value={values.fullName} />
      <input type="hidden" name="phoneNumber" value={values.phoneNumber} />
      <input type="hidden" name="headline" value={values.headline} />
      <input type="hidden" name="currentTitle" value={values.currentTitle} />
      <input type="hidden" name="currentEmployer" value={values.currentEmployer} />
      <input type="hidden" name="currentDesignation" value={values.currentDesignation} />
      <input type="hidden" name="location" value={values.location} />
      <input type="hidden" name="totalExperience" value={values.totalExperience} />
      <input type="hidden" name="skills" value={skillInput} />
      <input type="hidden" name="preferredRoles" value={values.preferredRoles} />
      <input type="hidden" name="preferredLocations" value={values.preferredLocations} />
      <input type="hidden" name="availability" value={values.availability} />
      <input type="hidden" name="employmentStatus" value={values.employmentStatus} />
      <input type="hidden" name="lastWorkingDate" value={values.lastWorkingDate} />
      <input type="hidden" name="noticePeriodDays" value={values.noticePeriodDays} />
      <input type="hidden" name="currentCtcLpa" value={normalizedCurrentCtcLpa ?? ''} />
      <input type="hidden" name="expectedCtcLpa" value={normalizedExpectedCtcLpa ?? ''} />
      <input type="hidden" name="summary" value={values.summary} />
      <input type="hidden" name="portfolioUrl" value={values.portfolioUrl} />
      <input type="hidden" name="linkedInUrl" value={values.linkedInUrl} />
      <input type="hidden" name="githubUrl" value={values.githubUrl} />
      <input type="hidden" name="profilePhotoAction" value={profilePhoto.action} />
      <input type="hidden" name="profileVisibility" value={values.profileVisibility} />
      <input type="hidden" name="workplacePreferencesJson" value={JSON.stringify(workplacePreferences)} />
      <input type="hidden" name="employmentPreferencesJson" value={JSON.stringify(employmentPreferences)} />
      <input type="hidden" name="searchableProfile" value={String(privacy.searchableProfile)} />
      <input type="hidden" name="phoneVisibleToRecruiters" value={String(privacy.phoneVisibleToRecruiters)} />
      <input type="hidden" name="salaryVisibleToRecruiters" value={String(privacy.salaryVisibleToRecruiters)} />
      <input type="hidden" name="resumeVisibleToRecruiters" value={String(privacy.resumeVisibleToRecruiters)} />
      <input type="hidden" name="experienceEntries" value={serializeStructuredArray(experienceEntries)} />
      <input type="hidden" name="educationEntries" value={serializeStructuredArray(educationEntries)} />
      <input type="hidden" name="certificationEntries" value={serializeStructuredArray(certificationEntries)} />
      <input type="hidden" name="languageEntries" value={serializeStructuredArray(languageEntries)} />
      <input type="hidden" name="projectEntries" value={serializeStructuredArray(projectEntries)} />

      {state.status !== 'idle' ? (
        <Alert
          ref={summaryRef}
          tone={state.status === 'error' ? 'danger' : 'success'}
          title={state.status === 'error' ? 'Profile could not be saved' : 'Profile saved'}
          tabIndex={-1}
        >
          <div className="space-y-2">
            <p>{state.message}</p>
          </div>
        </Alert>
      ) : null}

      <SectionCard id="resume-headline" title="Resume headline" description={null} onAction={() => setActiveSection('resume-headline')}>
        <div className="rounded-2xl border border-[var(--line)] p-4">
          <p className="mt-2 text-sm text-[var(--color-text)]">{readOnlyValue(values.headline)}</p>
        </div>
      </SectionCard>

      <SectionCard id="profile-summary" title="Profile summary" description={null} onAction={() => setActiveSection('profile-summary')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <CollapsibleSummary value={values.summary} />
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Portfolio URL</p><p className="mt-2 text-sm text-[var(--color-text)]">{readOnlyValue(values.portfolioUrl)}</p></div>
          <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">LinkedIn URL</p><p className="mt-2 text-sm text-[var(--color-text)]">{readOnlyValue(values.linkedInUrl)}</p></div>
          <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">GitHub URL</p><p className="mt-2 text-sm text-[var(--color-text)]">{readOnlyValue(values.githubUrl)}</p></div>
        </div>
      </SectionCard>

      <SectionCard id="key-skills" title="Key skills" description={null} actionLabel={skills.length ? 'Edit' : 'Add skills'} onAction={() => setActiveSection('key-skills')}>
        {skills.length ? <TagList items={skills} /> : <EmptyState message="No key skills added yet." actionLabel="Add skills" onAction={() => setActiveSection('key-skills')} />}
      </SectionCard>

      <div id="it-skills" className="scroll-mt-24" aria-hidden="true" />

      <SectionCard id="employment" title="Employment" description={null} actionLabel={experienceEntries.length ? 'Edit' : '+ Add Employment'} onAction={() => setActiveSection('employment')}>
        {experienceEntries.length ? (
          <div className="grid gap-4">
            {experienceEntries.map((entry, index) => (
              <StructuredPreviewCard key={`experience-preview-${index}`} title={`${entry.title || 'Role not added'}${entry.company ? ` · ${entry.company}` : ''}`}>
                <p>{entry.startDate || 'Start date not added'} - {entry.currentlyWorking ? 'Present' : (entry.endDate || 'End date not added')}</p>
                <p>{entry.location || 'Location not added'}</p>
                <p>{entry.summary || 'No responsibilities added yet.'}</p>
                <TagList items={normalizeStringArray(entry.technologies)} />
              </StructuredPreviewCard>
            ))}
          </div>
        ) : <EmptyState message="No employment history added yet." actionLabel="+ Add Employment" onAction={() => setActiveSection('employment')} />}
      </SectionCard>

      <SectionCard id="education" title="Education" description={null} actionLabel={educationEntries.length ? 'Edit' : '+ Add Education'} onAction={() => setActiveSection('education')}>
        {educationEntries.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {educationEntries.map((entry, index) => (
              <StructuredPreviewCard key={`education-preview-${index}`} title={entry.degree || 'Education'}>
                <p>{entry.institution || 'Institution not added'}</p>
                <p>{entry.fieldOfStudy || 'Field of study not added'}</p>
                <p>{entry.startYear || 'Start year'} - {entry.endYear || 'End year'}</p>
                <p>{entry.score || 'Score not added'}</p>
              </StructuredPreviewCard>
            ))}
          </div>
        ) : <EmptyState message="No education details added yet." actionLabel="+ Add Education" onAction={() => setActiveSection('education')} />}
      </SectionCard>

      <SectionCard id="projects" title="Projects" description={null} actionLabel={projectEntries.length ? 'Edit' : '+ Add Project'} onAction={() => setActiveSection('projects')}>
        {projectEntries.length ? (
          <div className="grid gap-4">
            {projectEntries.map((entry, index) => (
              <StructuredPreviewCard key={`project-preview-${index}`} title={entry.projectName || 'Project'}>
                <p>{entry.role || 'Role not added'}{entry.company ? ` · ${entry.company}` : ''}</p>
                <p>{entry.duration || 'Duration not added'}</p>
                <p>{entry.domain || 'Domain not added'}</p>
                <p>{entry.summary || 'Description not added yet.'}</p>
                <TagList items={normalizeStringArray(entry.technologies)} />
              </StructuredPreviewCard>
            ))}
          </div>
        ) : <EmptyState message="No projects added yet." actionLabel="+ Add Project" onAction={() => setActiveSection('projects')} />}
      </SectionCard>

      <SectionCard id="certifications" title="Certifications" description={null} actionLabel={certificationEntries.length ? 'Edit' : '+ Add Certification'} onAction={() => setActiveSection('certifications')}>
        {certificationEntries.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {certificationEntries.map((entry, index) => (
              <StructuredPreviewCard key={`certification-preview-${index}`} title={entry.name || 'Certification'}>
                <p>{entry.issuingOrganisation || 'Issuing organisation not added'}</p>
                <p>{entry.issueDate || 'Issue date not added'}{entry.expiryDate ? ` · Expires ${entry.expiryDate}` : ''}</p>
                <p>{entry.credentialId || entry.credentialUrl || 'Credential details not added'}</p>
              </StructuredPreviewCard>
            ))}
          </div>
        ) : <EmptyState message="No certifications added yet." actionLabel="+ Add Certification" onAction={() => setActiveSection('certifications')} />}
      </SectionCard>

      <SectionCard id="career-profile" title="Career profile" description={null} onAction={() => setActiveSection('career-profile')}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Preferred roles', readOnlyValue(values.preferredRoles)],
            ['Preferred locations', readOnlyValue(values.preferredLocations)],
            ['Expected annual CTC', formatCandidateAnnualCtc(normalizedExpectedCtcLpa)],
            ['Availability', readOnlyValue(values.availability.replaceAll('_', ' '))],
            ['Notice period', values.noticePeriodDays ? `${values.noticePeriodDays} days` : 'Not added'],
            ['Employment status', readOnlyValue(values.employmentStatus.replaceAll('_', ' '))],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
              <p className="mt-2 text-sm text-[var(--color-text)]">{value}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-[var(--line)] p-4 md:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Workplace preferences</p>
            <div className="mt-3"><TagList items={workplacePreferences.map((item) => item.replaceAll('_', ' '))} /></div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4 md:col-span-2 xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Employment preferences</p>
            <div className="mt-3"><TagList items={employmentPreferences.map((item) => item.replaceAll('_', ' '))} /></div>
          </div>
        </div>
      </SectionCard>

      <SectionCard id="personal-details" title="Personal details" description={null} actionLabel="Edit" onAction={() => setActiveSection('personal-details')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Languages</p>
            <div className="mt-3 grid gap-2">
              {languageEntries.filter((entry) => entry.language).length ? languageEntries.filter((entry) => entry.language).map((entry) => (
                <div key={`${entry.language}-${entry.proficiency}`} className="rounded-2xl bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)]">
                  <p className="font-semibold">{entry.language}</p>
                  <p className="mt-1 text-[var(--color-text-muted)]">{entry.proficiency || 'Proficiency not added'}</p>
                  <p className="mt-1 text-[var(--color-text-muted)]">
                    Read {entry.read ? 'Yes' : 'No'} · Write {entry.write ? 'Yes' : 'No'} · Speak {entry.speak ? 'Yes' : 'No'}
                  </p>
                </div>
              )) : <p className="text-sm text-[var(--color-text-muted)]">No languages added yet.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Current contact snapshot</p>
            <p className="mt-3 text-sm text-[var(--color-text)]">Phone: {readOnlyValue(values.phoneNumber)}</p>
            <p className="mt-2 text-sm text-[var(--color-text)]">Location: {readOnlyValue(values.location)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard id="privacy" title="Privacy" description={null} onAction={() => setActiveSection('privacy')}>
        <div className="grid gap-3">
          {[
            ['Profile discovery', privacy.searchableProfile],
            ['Phone visibility', privacy.phoneVisibleToRecruiters],
            ['Salary visibility', privacy.salaryVisibleToRecruiters],
            ['Resume visibility', privacy.resumeVisibleToRecruiters],
          ].map(([label, enabled]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
              <span className="font-medium text-[var(--color-text)]">{label}</span>
              <span className={enabled ? 'text-emerald-700' : 'text-[var(--color-text-muted)]'}>{enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <Dialog
        open={Boolean(activeSection)}
        onClose={() => setActiveSection(null)}
        title={activeSection ? sectionLabels[activeSection] : ''}
        description={null}
        className="max-w-4xl"
      >
        <div className="grid gap-5">
          {renderEditor()}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" form={formId} disabled={pending} loading={pending}>{pending ? 'Saving...' : 'Save changes'}</Button>
            <Button type="button" variant="outline" onClick={() => setActiveSection(null)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </form>
  );
}
