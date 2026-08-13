"use client";

import { useMemo, useState, useTransition } from 'react';
import { LoaderCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { normalizeCtcToLpa } from '@/lib/ctc';

const steps = [
  { id: 'job-details', label: 'Job Details' },
  { id: 'candidate-preferences', label: 'Candidate Preferences' },
  { id: 'screening-questions', label: 'Screening Questions' },
  { id: 'job-description', label: 'Job Description' },
  { id: 'communication', label: 'Communication Preferences' },
  { id: 'review', label: 'Review & Publish' },
];

function defaultQuestion() {
  return {
    localId: crypto.randomUUID(),
    questionText: '',
    questionType: 'SHORT_TEXT',
    required: true,
    placeholder: '',
    options: '',
  };
}

async function requestJobIntelligence(payload) {
  const response = await fetch('/api/intelligence/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || 'Unable to generate job description.');
  }
  return body?.data;
}

function buildJobDescriptionPromptSource({
  organisationName,
  organisationAbout,
  formState,
  skills,
}) {
  const lines = [
    organisationName ? `Company: ${organisationName}` : null,
    formState.title ? `Job Title: ${formState.title}` : null,
    formState.location ? `Location: ${formState.location}` : null,
    formState.department ? `Department: ${formState.department}` : null,
    formState.businessUnit ? `Role / Business Unit: ${formState.businessUnit}` : null,
    formState.experienceMin || formState.experienceMax
      ? `Experience: ${formState.experienceMin || 0}-${formState.experienceMax || 0} years`
      : null,
    formState.employmentType ? `Employment Type: ${formState.employmentType}` : null,
    formState.workplaceType ? `Workplace Type: ${formState.workplaceType}` : null,
    skills.length ? `Skills: ${skills.join(', ')}` : null,
    formState.requirements ? `Qualifications: ${formState.requirements}` : null,
    formState.responsibilities ? `Responsibilities: ${formState.responsibilities}` : null,
    formState.description ? `Existing Job Summary: ${formState.description}` : null,
    organisationAbout ? `About Company: ${organisationAbout}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

function normalizeGeneratedJobDescription(result) {
  const payload = result?.assisted || result?.deterministic || result || {};
  return {
    summary: String(payload.summary || '').trim(),
    responsibilities: Array.isArray(payload.responsibilities) ? payload.responsibilities : [],
    requiredSkills: Array.isArray(payload.requiredSkills) ? payload.requiredSkills : [],
    preferredSkills: Array.isArray(payload.preferredSkills) ? payload.preferredSkills : [],
    assumptions: Array.isArray(payload.assumptions) ? payload.assumptions : [],
    missingFields: Array.isArray(payload.missingFields) ? payload.missingFields : [],
  };
}

function StepRail({ activeStep, onSelect }) {
  return (
    <div className="grid gap-2">
      {steps.map((step, index) => {
        const active = activeStep === step.id;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-left text-sm font-semibold ${
              active
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--color-text)]">
              {index + 1}
            </span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RecruiterJobPostWizard({
  organisationName,
  organisationAbout,
  assignees = [],
  requisitions = [],
  recruiterEmail,
  createAction,
}) {
  const [activeStep, setActiveStep] = useState(steps[0].id);
  const [skillsInput, setSkillsInput] = useState('');
  const [skills, setSkills] = useState([]);
  const [salaryMinAmount, setSalaryMinAmount] = useState('');
  const [salaryMinUnit, setSalaryMinUnit] = useState('LAKH_PER_ANNUM');
  const [salaryMaxAmount, setSalaryMaxAmount] = useState('');
  const [salaryMaxUnit, setSalaryMaxUnit] = useState('LAKH_PER_ANNUM');
  const [screeningQuestions, setScreeningQuestions] = useState([defaultQuestion()]);
  const [wizardState, setWizardState] = useState({
    title: '',
    location: '',
    experienceMin: '',
    experienceMax: '',
    employmentType: 'FULL_TIME',
    workplaceType: '',
    department: '',
    businessUnit: '',
    description: '',
    responsibilities: '',
    requirements: '',
    benefits: '',
    applicationNotificationEmail: recruiterEmail || '',
  });
  const [generatedDescription, setGeneratedDescription] = useState(null);
  const [generationError, setGenerationError] = useState('');
  const [generatingDescription, startDescriptionGeneration] = useTransition();

  function commitSkills(nextValue) {
    const tokens = String(nextValue || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!tokens.length) return;

    setSkills((current) => {
      const seen = new Set(current.map((item) => item.toLowerCase()));
      const additions = tokens.filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...current, ...additions];
    });
    setSkillsInput('');
  }

  function removeSkill(skill) {
    setSkills((current) => current.filter((item) => item !== skill));
  }

  function updateQuestion(localId, field, value) {
    setScreeningQuestions((current) => current.map((item) => (
      item.localId === localId ? { ...item, [field]: value } : item
    )));
  }

  function updateWizardField(field, value) {
    setWizardState((current) => ({ ...current, [field]: value }));
  }

  function applyGeneratedDescription() {
    if (!generatedDescription) return;

    setWizardState((current) => ({
      ...current,
      description: generatedDescription.summary || current.description,
      responsibilities: generatedDescription.responsibilities.join('\n') || current.responsibilities,
      requirements: generatedDescription.preferredSkills.join('\n') || current.requirements,
      benefits: current.benefits,
    }));

    if (generatedDescription.requiredSkills.length) {
      setSkills((current) => {
        const seen = new Set(current.map((item) => item.toLowerCase()));
        const additions = generatedDescription.requiredSkills.filter((item) => {
          const normalized = String(item || '').trim();
          const key = normalized.toLowerCase();
          if (!normalized || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...current, ...additions];
      });
    }
  }

  function handleGenerateJobDescription() {
    setGenerationError('');
    startDescriptionGeneration(async () => {
      try {
        const payload = await requestJobIntelligence({
          mode: 'DRAFT_DESCRIPTION',
          sourceDescription: buildJobDescriptionPromptSource({
            organisationName,
            organisationAbout,
            formState: wizardState,
            skills,
          }),
          forceRegenerate: true,
        });
        setGeneratedDescription(normalizeGeneratedJobDescription(payload));
      } catch (error) {
        setGenerationError(error.message || 'Unable to generate job description.');
      }
    });
  }

  const activeStepIndex = steps.findIndex((step) => step.id === activeStep);
  const normalizedSalaryMin = useMemo(
    () => normalizeCtcToLpa(salaryMinAmount, salaryMinUnit),
    [salaryMinAmount, salaryMinUnit],
  );
  const normalizedSalaryMax = useMemo(
    () => normalizeCtcToLpa(salaryMaxAmount, salaryMaxUnit),
    [salaryMaxAmount, salaryMaxUnit],
  );

  return (
    <form action={createAction} className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <input type="hidden" name="skillsRequired" value={skills.join(', ')} />
      <input type="hidden" name="salaryMin" value={normalizedSalaryMin ?? ''} />
      <input type="hidden" name="salaryMax" value={normalizedSalaryMax ?? ''} />
      <input type="hidden" name="currency" value="INR" />
      {screeningQuestions.map((question) => (
        <div key={question.localId} className="hidden">
          <input name="screeningQuestionText" value={question.questionText} readOnly />
          <input name="screeningQuestionType" value={question.questionType} readOnly />
          <input name="screeningQuestionRequired" value={question.required ? 'true' : 'false'} readOnly />
          <input name="screeningQuestionPlaceholder" value={question.placeholder} readOnly />
          <input name="screeningQuestionOptions" value={question.options} readOnly />
        </div>
      ))}

      <StepRail activeStep={activeStep} onSelect={setActiveStep} />

      <div className="space-y-5">
        {/* Every step stays mounted (hidden via CSS, not unmounted) so FormData
            at final submit includes fields from every step, not just the one
            currently in view - a step-by-step wizard whose earlier steps
            vanish from the form the moment you move on would silently drop
            title/location/description/etc. on submit. */}
        <div className={activeStep === 'job-details' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Job Details</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Create the core job definition recruiters and candidates will see first.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Posting as" value={organisationName} readOnly />
              <Input label="Company name" name="companyNameDisplay" defaultValue={organisationName} readOnly />
              <Input label="Job title" name="title" value={wizardState.title} onChange={(event) => updateWizardField('title', event.target.value)} placeholder="Senior Java Developer" required />
              <Input label="Job location" name="location" value={wizardState.location} onChange={(event) => updateWizardField('location', event.target.value)} placeholder="Bengaluru, Hyderabad" required />
              <Input label="Minimum experience" name="experienceMin" type="number" min="0" value={wizardState.experienceMin} onChange={(event) => updateWizardField('experienceMin', event.target.value)} required />
              <Input label="Maximum experience" name="experienceMax" type="number" min="0" value={wizardState.experienceMax} onChange={(event) => updateWizardField('experienceMax', event.target.value)} required />
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Minimum annual salary<span className="ml-1 text-[var(--color-danger)]">*</span></span>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <Input value={salaryMinAmount} onChange={(event) => setSalaryMinAmount(event.target.value)} placeholder="10" required />
                  <select value={salaryMinUnit} onChange={(event) => setSalaryMinUnit(event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                    <option value="LAKH_PER_ANNUM">Lakh per annum</option>
                    <option value="CRORE_PER_ANNUM">Crore per annum</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Maximum annual salary<span className="ml-1 text-[var(--color-danger)]">*</span></span>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <Input value={salaryMaxAmount} onChange={(event) => setSalaryMaxAmount(event.target.value)} placeholder="25" required />
                  <select value={salaryMaxUnit} onChange={(event) => setSalaryMaxUnit(event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                    <option value="LAKH_PER_ANNUM">Lakh per annum</option>
                    <option value="CRORE_PER_ANNUM">Crore per annum</option>
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2 md:col-span-2">
                <input name="hideSalaryFromCandidates" type="checkbox" className="mt-0.5" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">Hide salary from candidates</span>
                  <br />
                  Salary will be used internally for matching and hiring intelligence but will not be displayed on the public job posting.
                </span>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Employment type</span>
                <select name="employmentType" value={wizardState.employmentType} onChange={(event) => updateWizardField('employmentType', event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Internship</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Workplace</span>
                <select name="workplaceType" value={wizardState.workplaceType} onChange={(event) => updateWizardField('workplaceType', event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="">Select workplace</option>
                  <option value="ONSITE">Onsite</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="REMOTE">Remote</option>
                </select>
              </label>
              <Input label="Department" name="department" value={wizardState.department} onChange={(event) => updateWizardField('department', event.target.value)} placeholder="Engineering" />
              <Input label="Business unit" name="businessUnit" value={wizardState.businessUnit} onChange={(event) => updateWizardField('businessUnit', event.target.value)} placeholder="Product Engineering" />
              <Input label="Openings" name="numberOfOpenings" type="number" min="1" defaultValue="1" />
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Recruiter owner</span>
                <select name="recruiterId" defaultValue="" className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="">Use my recruiter account</option>
                  {assignees.map((member) => (
                    <option key={member.id} value={member.userId}>{member.user?.email || member.userId}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Hiring manager</span>
                <select name="hiringManagerId" defaultValue="" className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="">Select hiring manager</option>
                  {assignees.map((member) => (
                    <option key={member.id} value={member.userId}>{member.user?.email || member.userId}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Approved requisition</span>
                <select name="requisitionId" defaultValue="" className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                  <option value="">No linked requisition</option>
                  {requisitions.map((requisition) => (
                    <option key={requisition.id} value={requisition.id}>{requisition.requisitionCode} - {requisition.title}</option>
                  ))}
                </select>
              </label>
            </div>
          </Card>
        </div>

        <div className={activeStep === 'candidate-preferences' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Candidate Preferences</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Capture the must-have skills and hiring expectations recruiters want to screen against.</p>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Add skills</span>
                <Input
                  value={skillsInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue.includes(',')) {
                      commitSkills(nextValue);
                      return;
                    }
                    setSkillsInput(nextValue);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitSkills(skillsInput);
                    }
                  }}
                  onBlur={() => commitSkills(skillsInput)}
                  placeholder="Java, Spring Boot, AWS"
                  helpText="Type a skill and use comma or Enter to add it."
                />
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Candidate qualifications</span>
                <textarea
                  name="requirements"
                  value={wizardState.requirements}
                  onChange={(event) => updateWizardField('requirements', event.target.value)}
                  rows={6}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
                  placeholder={'Graduate\nPost Graduate\nRelevant domain experience'}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Preferred candidate profile</span>
                <textarea
                  name="responsibilities"
                  value={wizardState.responsibilities}
                  onChange={(event) => updateWizardField('responsibilities', event.target.value)}
                  rows={6}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]"
                  placeholder={'Design backend services\nCollaborate with product and QA\nMentor team members'}
                />
              </label>
            </div>
          </Card>
        </div>

        <div className={activeStep === 'screening-questions' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--color-text)]">Screening Questions</h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Add recruiter review questions that will be attached when the job is published.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setScreeningQuestions((current) => [...current, defaultQuestion()])}>
                <Plus size={16} aria-hidden="true" />
                Add question
              </Button>
            </div>
            <div className="space-y-4">
              {screeningQuestions.map((question, index) => (
                <div key={question.localId} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Question {index + 1}</p>
                    {screeningQuestions.length > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setScreeningQuestions((current) => current.filter((item) => item.localId !== question.localId))}>
                        <Trash2 size={14} aria-hidden="true" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input label="Question" value={question.questionText} onChange={(event) => updateQuestion(question.localId, 'questionText', event.target.value)} placeholder="What is your current annual CTC?" />
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">Answer type</span>
                      <select value={question.questionType} onChange={(event) => updateQuestion(question.localId, 'questionType', event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]">
                        <option value="SHORT_TEXT">Text</option>
                        <option value="YES_NO">Yes / No</option>
                        <option value="NUMBER">Number</option>
                        <option value="SINGLE_SELECT">Single Select</option>
                        <option value="MULTI_SELECT">Multi Select</option>
                      </select>
                    </label>
                    <Input label="Placeholder" value={question.placeholder} onChange={(event) => updateQuestion(question.localId, 'placeholder', event.target.value)} placeholder="Enter candidate answer" />
                    {(question.questionType === 'SINGLE_SELECT' || question.questionType === 'MULTI_SELECT') ? (
                      <Input label="Options" value={question.options} onChange={(event) => updateQuestion(question.localId, 'options', event.target.value)} placeholder="Yes, No, Maybe" />
                    ) : <div />}
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                      <input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.localId, 'required', event.target.checked)} />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={activeStep === 'job-description' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Job Description</h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Write the recruiter-facing brief, then add responsibilities, requirements, and benefits in structured lists.</p>
              </div>
              <Button type="button" variant="outline" onClick={handleGenerateJobDescription} disabled={generatingDescription || wizardState.title.trim().length < 2}>
                <Sparkles size={16} aria-hidden="true" />
                {generatedDescription ? 'Regenerate' : 'Generate with AI'}
              </Button>
            </div>
            <div className="grid gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">About company preview</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {organisationAbout || 'Add an organisation overview on the recruiter Home page to auto-fill company context here.'}
                </p>
              </div>
              {generatingDescription ? (
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                  <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                  Generating recruiter-reviewable job description...
                </div>
              ) : null}
              {generationError ? (
                <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {generationError}
                </div>
              ) : null}
              {generatedDescription ? (
                <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">AI-generated draft</p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Review the generated summary and apply it only when you want to replace the current draft.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={applyGeneratedDescription}>
                      Apply generated content
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text)]">Job summary</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{generatedDescription.summary || 'No summary generated yet.'}</p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text)]">Required skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {generatedDescription.requiredSkills.length ? generatedDescription.requiredSkills.map((skill) => (
                          <span key={skill} className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{skill}</span>
                        )) : <p className="text-sm text-[var(--color-text-secondary)]">No required skills generated.</p>}
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text)]">Responsibilities</p>
                      <ul className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                        {generatedDescription.responsibilities.length ? generatedDescription.responsibilities.map((item) => (
                          <li key={item}>{item}</li>
                        )) : <li>No responsibilities generated.</li>}
                      </ul>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text)]">Review notes</p>
                      <ul className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                        {[...generatedDescription.assumptions, ...generatedDescription.missingFields].length
                          ? [...generatedDescription.assumptions, ...generatedDescription.missingFields].map((item) => <li key={item}>{item}</li>)
                          : <li>No review notes.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Job summary</span>
                <textarea name="description" value={wizardState.description} onChange={(event) => updateWizardField('description', event.target.value)} rows={8} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" placeholder="Write the job summary, role scope, and why the opportunity matters." required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Perks & benefits</span>
                <textarea name="benefits" value={wizardState.benefits} onChange={(event) => updateWizardField('benefits', event.target.value)} rows={5} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)]" placeholder={'Health insurance\nProvident fund\nFlexible working'} />
              </label>
            </div>
          </Card>
        </div>

        <div className={activeStep === 'communication' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Communication Preferences</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Application records stay in Careeriz. Email is a notification channel only and does not replace Job Responses or ATS.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Application notification email"
                name="applicationNotificationEmail"
                type="email"
                value={wizardState.applicationNotificationEmail}
                onChange={(event) => updateWizardField('applicationNotificationEmail', event.target.value)}
                helpText="New application notifications will be sent to this email."
                placeholder="recruiter@company.com"
              />
              <Input label="Application deadline" name="applicationDeadline" type="datetime-local" />
              <Input label="Applications open from" name="applicationOpensAt" type="datetime-local" />
              <Input label="Applications close on" name="applicationClosesAt" type="datetime-local" />
              <Input label="Maximum applications" name="maxApplications" type="number" min="1" />
              <Input label="Target hires" name="targetHires" type="number" min="1" />
            </div>
            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
              <label className="flex items-center gap-2">
                <input name="isPublic" type="checkbox" defaultChecked />
                Show this job publicly on Careeriz
              </label>
              <label className="flex items-center gap-2">
                <input name="featuredInPortal" type="checkbox" />
                Feature this role on the public jobs portal
              </label>
              <label className="flex items-center gap-2">
                <input name="autoCloseOnTargetHire" type="checkbox" />
                Auto-close when target hires are reached
              </label>
            </div>
          </Card>
        </div>

        <div className={activeStep === 'review' ? undefined : 'hidden'}>
          <Card className="grid gap-5">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">Review & Publish</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Confirm the core role details before saving a draft or publishing the job.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.length ? skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{skill}</span>
                  )) : <p className="text-sm text-[var(--color-text-secondary)]">No skills added yet.</p>}
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Screening questions</p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{screeningQuestions.filter((item) => item.questionText).length} questions will be attached after the job is created.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="outline" name="status" value="DRAFT">Save Draft</Button>
              <Button type="submit" name="status" value="OPEN">Publish Job</Button>
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStep(steps[Math.max(0, activeStepIndex - 1)].id)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={activeStepIndex === steps.length - 1}
            onClick={() => setActiveStep(steps[Math.min(steps.length - 1, activeStepIndex + 1)].id)}
          >
            Next
          </Button>
        </div>
      </div>
    </form>
  );
}
