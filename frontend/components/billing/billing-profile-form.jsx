"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { upsertBillingProfile } from '@/lib/api';

const FIELDS = [
  { name: 'legalCompanyName', label: 'Legal company name', required: true },
  { name: 'billingEmail', label: 'Billing email', type: 'email', required: true },
  { name: 'billingPhone', label: 'Billing phone' },
  { name: 'addressLine1', label: 'Address line 1', required: true },
  { name: 'addressLine2', label: 'Address line 2' },
  { name: 'city', label: 'City', required: true },
  { name: 'state', label: 'State', required: true },
  { name: 'stateCode', label: 'GST state code (2 digits)', required: true, maxLength: 2 },
  { name: 'postalCode', label: 'Postal code', required: true },
  { name: 'gstin', label: 'GSTIN (optional)' },
];

export function BillingProfileForm({ initialProfile }) {
  const [values, setValues] = useState(() => ({
    legalCompanyName: initialProfile?.legalCompanyName || '',
    billingEmail: initialProfile?.billingEmail || '',
    billingPhone: initialProfile?.billingPhone || '',
    addressLine1: initialProfile?.addressLine1 || '',
    addressLine2: initialProfile?.addressLine2 || '',
    city: initialProfile?.city || '',
    state: initialProfile?.state || '',
    stateCode: initialProfile?.stateCode || '',
    postalCode: initialProfile?.postalCode || '',
    country: initialProfile?.country || 'IN',
    gstin: initialProfile?.gstin || '',
  }));
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(null);
    try {
      await upsertBillingProfile({
        ...values,
        billingPhone: values.billingPhone || null,
        addressLine2: values.addressLine2 || null,
        gstin: values.gstin || null,
      });
      setStatus('saved');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error?.message || 'Could not save billing details.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      {FIELDS.map((field) => (
        <label key={field.name} className="grid gap-1.5 text-sm">
          <span className="font-medium text-[var(--color-text)]">
            {field.label}
            {field.required ? <span aria-hidden="true" className="text-[var(--color-danger)]"> *</span> : null}
          </span>
          <input
            type={field.type || 'text'}
            required={field.required}
            maxLength={field.maxLength}
            value={values[field.name]}
            onChange={(event) => updateField(field.name, event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[color:rgba(79,156,249,0.18)]"
          />
        </label>
      ))}
      <div className="md:col-span-2 flex items-center gap-3 pt-2">
        <Button type="submit" loading={status === 'saving'}>Save billing details</Button>
        {status === 'saved' ? <p role="status" className="text-sm text-emerald-700">Saved.</p> : null}
        {status === 'error' && errorMessage ? <p role="alert" className="text-sm text-[var(--color-danger)]">{errorMessage}</p> : null}
      </div>
    </form>
  );
}
