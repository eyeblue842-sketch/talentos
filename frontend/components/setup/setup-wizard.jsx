"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const steps = [
  { id: 1, label: 'Organization' },
  { id: 2, label: 'Super Admin' },
  { id: 3, label: 'Preferences' },
  { id: 4, label: 'Confirmation' },
];

const initialValues = {
  companyName: '',
  companyLogoUrl: '',
  industry: '',
  country: '',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  dateFormat: 'DD MMM YYYY',
  name: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
  language: 'English',
  defaultMeetingProvider: 'CUSTOM',
  googleEnabled: false,
  zoomEnabled: false,
  emailProvider: 'SMTP',
  aiEnabled: false,
  notificationEmail: true,
  notificationInApp: true,
};

function StepIndicator({ currentStep }) {
  return (
    <ol className="grid gap-3 md:grid-cols-4" aria-label="Setup progress">
      {steps.map((step) => (
        <li key={step.id} className={`rounded-2xl border px-4 py-3 text-sm ${currentStep >= step.id ? 'border-[var(--brand)] bg-[var(--color-primary-soft)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>
          <span className="font-semibold">{step.id}.</span> {step.label}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-[var(--text)]">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function validateStep(step, values) {
  const errors = {};
  if (step === 1) {
    if (!values.companyName.trim()) errors.companyName = 'Company name is required.';
    if (!values.industry.trim()) errors.industry = 'Industry is required.';
    if (!values.country.trim()) errors.country = 'Country is required.';
    if (!values.timezone.trim()) errors.timezone = 'Timezone is required.';
    if (!values.currency.trim()) errors.currency = 'Currency is required.';
    if (!values.dateFormat.trim()) errors.dateFormat = 'Date format is required.';
  }
  if (step === 2) {
    if (!values.name.trim()) errors.name = 'Name is required.';
    if (!values.email.trim()) errors.email = 'Email is required.';
    if (!values.mobile.trim()) errors.mobile = 'Mobile is required.';
    if (values.password.length < 12 || !/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password) || !/[^A-Za-z0-9]/.test(values.password)) {
      errors.password = 'Use at least 12 characters with uppercase, lowercase, number, and special character.';
    }
    if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  }
  if (step === 3) {
    if (!values.language.trim()) errors.language = 'Language is required.';
    if (!values.defaultMeetingProvider) errors.defaultMeetingProvider = 'Default meeting provider is required.';
    if (!values.emailProvider.trim()) errors.emailProvider = 'Email provider is required.';
  }
  return errors;
}

function buildPayload(values) {
  return {
    organisation: {
      companyName: values.companyName,
      companyLogoUrl: values.companyLogoUrl || undefined,
      industry: values.industry,
      country: values.country,
      timezone: values.timezone,
      currency: values.currency,
      dateFormat: values.dateFormat,
    },
    superAdmin: {
      name: values.name,
      email: values.email,
      mobile: values.mobile,
      password: values.password,
      confirmPassword: values.confirmPassword,
    },
    preferences: {
      language: values.language,
      defaultMeetingProvider: values.defaultMeetingProvider,
      googleEnabled: values.googleEnabled,
      zoomEnabled: values.zoomEnabled,
      emailProvider: values.emailProvider,
      aiEnabled: values.aiEnabled,
      notificationPreferences: {
        email: values.notificationEmail,
        inApp: values.notificationInApp,
      },
    },
  };
}

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const payloadPreview = useMemo(() => buildPayload(values), [values]);

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function nextStep() {
    const nextErrors = validateStep(step, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStep((current) => Math.min(4, current + 1));
  }

  function previousStep() {
    setErrors({});
    setStep((current) => Math.max(1, current - 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateStep(3, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStep(3);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api'}/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadPreview),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || 'Setup failed.');
      }

      router.push('/auth?setup=complete');
      router.refresh();
    } catch (error) {
      setSubmitError(error.message || 'Setup failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepIndicator currentStep={step} />

      {step === 1 ? (
        <Card className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Company Name" error={errors.companyName}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.companyName} onChange={(event) => updateValue('companyName', event.target.value)} />
          </Field>
          <Field label="Company Logo URL (optional)" error={errors.companyLogoUrl}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.companyLogoUrl} onChange={(event) => updateValue('companyLogoUrl', event.target.value)} />
          </Field>
          <Field label="Industry" error={errors.industry}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.industry} onChange={(event) => updateValue('industry', event.target.value)} />
          </Field>
          <Field label="Country" error={errors.country}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.country} onChange={(event) => updateValue('country', event.target.value)} />
          </Field>
          <Field label="Timezone" error={errors.timezone}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.timezone} onChange={(event) => updateValue('timezone', event.target.value)} />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.currency} onChange={(event) => updateValue('currency', event.target.value)} />
          </Field>
          <Field label="Date Format" error={errors.dateFormat}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.dateFormat} onChange={(event) => updateValue('dateFormat', event.target.value)} />
          </Field>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.name} onChange={(event) => updateValue('name', event.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.email} onChange={(event) => updateValue('email', event.target.value)} />
          </Field>
          <Field label="Mobile" error={errors.mobile}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.mobile} onChange={(event) => updateValue('mobile', event.target.value)} />
          </Field>
          <Field label="Password" error={errors.password}>
            <input type="password" className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.password} onChange={(event) => updateValue('password', event.target.value)} />
          </Field>
          <Field label="Confirm Password" error={errors.confirmPassword}>
            <input type="password" className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.confirmPassword} onChange={(event) => updateValue('confirmPassword', event.target.value)} />
          </Field>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Language" error={errors.language}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.language} onChange={(event) => updateValue('language', event.target.value)} />
          </Field>
          <Field label="Default Meeting Provider" error={errors.defaultMeetingProvider}>
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.defaultMeetingProvider} onChange={(event) => updateValue('defaultMeetingProvider', event.target.value)}>
              <option value="CUSTOM">Custom</option>
              <option value="GOOGLE_MEET">Google Meet</option>
              <option value="ZOOM">Zoom</option>
            </select>
          </Field>
          <Field label="Email Provider" error={errors.emailProvider}>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" value={values.emailProvider} onChange={(event) => updateValue('emailProvider', event.target.value)} />
          </Field>
          <div className="grid gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm md:col-span-2">
            {[
              ['googleEnabled', 'Enable Google integration'],
              ['zoomEnabled', 'Enable Zoom integration'],
              ['aiEnabled', 'Enable AI features'],
              ['notificationEmail', 'Enable email notifications'],
              ['notificationInApp', 'Enable in-app notifications'],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={Boolean(values[key])} onChange={(event) => updateValue(key, event.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Confirm initial setup</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">This will create the first organization, the first super administrator account, default permissions, settings, and baseline system preferences.</p>
          </div>
          <pre className="overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs text-[var(--muted)]">{JSON.stringify(payloadPreview, null, 2)}</pre>
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="outline" onClick={previousStep} disabled={step === 1 || submitting}>Back</Button>
        {step < 4 ? (
          <Button type="button" onClick={nextStep}>Continue</Button>
        ) : (
          <Button type="submit" loading={submitting}>Complete Setup</Button>
        )}
      </div>
    </form>
  );
}
