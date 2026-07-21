import Link from 'next/link';
import { BriefcaseBusiness, History, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildSavedSearchHref, resumeSearchFilterSections } from '@/lib/recruiter-resume-search';
import { RecruiterTalentSearchAssistant } from '@/components/sections/recruiter-talent-search-assistant';

function Field({ field, value }) {
  if (field.type === 'select') {
    return (
      <Select name={field.name} label={field.label} defaultValue={value || ''}>
        {field.options.map((option) => (
          <option key={option || 'empty'} value={option}>
            {option || field.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="grid gap-2.5">
        <span className="text-sm font-semibold text-[var(--color-text)]">{field.label}</span>
        <textarea
          name={field.name}
          defaultValue={value || ''}
          placeholder={field.placeholder}
          className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
        />
      </label>
    );
  }

  return (
    <Input
      name={field.name}
      type={field.type}
      label={field.label}
      defaultValue={value || ''}
      placeholder={field.placeholder}
      min={field.type === 'number' ? 0 : undefined}
    />
  );
}

export function RecruiterResumeSearchFilters({ params, savedSearches, recentSearches, jobs = [], requisitions = [] }) {
  return (
    <div className="space-y-4">
      <RecruiterTalentSearchAssistant jobId={params.jobId || ''} requisitionId={params.requisitionId || ''} />

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-start gap-3">
          <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
            <BriefcaseBusiness size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Requirement Context</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Select the job or requisition you are hiring against before shortlisting or adding candidates into the ATS pipeline.
            </p>
          </div>
        </div>
      </div>

      <form action="/recruiter/database" className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
          <div className="grid gap-4">
            <Select name="jobId" label="Job Requirement" defaultValue={params.jobId || ''}>
              <option value="">Select job requirement</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </Select>
            <Select name="requisitionId" label="Requisition" defaultValue={params.requisitionId || ''}>
              <option value="">Select approved requisition</option>
              {requisitions.map((requisition) => (
                <option key={requisition.id} value={requisition.id}>{requisition.requisitionCode} - {requisition.title}</option>
              ))}
            </Select>
          </div>
        </div>

        {resumeSearchFilterSections.map((section, index) => (
          <details
            key={section.title}
            open={index < 2}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-md)]"
          >
            <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-[var(--color-text)]">
              {section.title}
            </summary>
            <div className="grid gap-4 border-t border-[var(--color-border)] px-4 py-4">
              {section.fields.filter((field) => !['jobId', 'requisitionId'].includes(field.name)).map((field) => (
                <Field key={field.name} field={field} value={params[field.name]} />
              ))}
            </div>
          </details>
        ))}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="flex-1">
            <Search size={16} aria-hidden="true" />
            Run Search
          </Button>
          <Button as="a" href="/recruiter/database" variant="outline" className="flex-1">
            Reset Filters
          </Button>
        </div>
      </form>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text)]">Saved Searches</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {savedSearches.map((item) => (
            <Link key={item.label} href={buildSavedSearchHref(item.params)} className="inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2">
          <History size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
          <p className="text-sm font-semibold text-[var(--color-text)]">Recent Searches</p>
        </div>
        {recentSearches.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {recentSearches.map((item) => (
              <Link key={item.label} href={item.href} className="inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                {item.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">Your recent recruiter queries will appear here during this browser session.</p>
        )}
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-md)]">
        <p className="text-sm font-semibold text-[var(--color-text)]">Result Policies</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="neutral">No employer names in global status</Badge>
          <Badge variant="neutral">Contact info remains permission-based</Badge>
          <Badge variant="neutral">ATS stages are organisation scoped</Badge>
        </div>
      </div>
    </div>
  );
}
