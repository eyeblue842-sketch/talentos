import { BriefcaseBusiness, MapPin, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const experienceOptions = [
  { value: '', label: 'Select experience' },
  { value: '0', label: 'Fresher friendly' },
  { value: '1', label: '1+ years' },
  { value: '3', label: '3+ years' },
  { value: '5', label: '5+ years' },
  { value: '8', label: '8+ years' },
];

function SelectField({ name, defaultValue, options, className, ...props }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className || 'min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]'}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value || option.label} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

export function PublicJobSearchForm({
  action = '/jobs',
  searchParams = {},
  organisationLocked = false,
  variant = 'filters',
}) {
  if (variant === 'hero') {
    return (
      <form action={action} className="grid gap-3 rounded-[24px] border border-[var(--color-border)] bg-white/94 p-3 shadow-[var(--shadow-floating)] backdrop-blur md:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(180px,1fr)] lg:items-center">
          <div className="grid">
            <div className="relative">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                id="hero-keyword"
                aria-label="Job title or skills"
                name="keyword"
                defaultValue={searchParams.keyword || ''}
                placeholder="Job title or skills"
                className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] pl-11 pr-4 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
              />
            </div>
          </div>
          <div className="grid">
            <div className="relative">
              <Sparkles size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <SelectField
                name="minExperience"
                defaultValue={searchParams.minExperience || ''}
                options={experienceOptions}
                aria-label="Select experience"
                className="h-12 w-full appearance-none rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] pl-11 pr-10 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
                id="hero-experience"
              />
            </div>
          </div>
          <div className="grid">
            <div className="relative">
              <MapPin size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                id="hero-location"
                aria-label="Choose location"
                name="location"
                defaultValue={searchParams.location || ''}
                placeholder="Choose location"
                className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] pl-11 pr-4 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
              />
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full justify-center px-5">
            <BriefcaseBusiness size={18} aria-hidden="true" />
            Search Jobs
          </Button>
        </div>
        <div className="rounded-[18px] border border-[var(--color-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-2.5 text-sm leading-6 text-[var(--color-text-secondary)]">
          Search across roles, skills, companies, and locations. Advanced filters remain available on the results page.
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-md)]">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <Input name="keyword" defaultValue={searchParams.keyword || ''} placeholder="Job title, skills or company" />
        <Input name="location" defaultValue={searchParams.location || ''} placeholder="Location" />
        <Input name="skills" defaultValue={searchParams.skills || ''} placeholder="Skills" />
        <SelectField
          name="workplaceType"
          defaultValue={searchParams.workplaceType || ''}
          options={[
            { value: '', label: 'Workplace type' },
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ONSITE', label: 'On-site' },
          ]}
        />
        <Button type="submit" className="w-full lg:w-auto">Search</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SelectField
          name="employmentType"
          defaultValue={searchParams.employmentType || ''}
          options={[
            { value: '', label: 'Employment type' },
            { value: 'FULL_TIME', label: 'Full-time' },
            { value: 'PART_TIME', label: 'Part-time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Internship' },
          ]}
        />
        <Input name="minExperience" type="number" min="0" defaultValue={searchParams.minExperience || ''} placeholder="Min exp" />
        <Input name="maxExperience" type="number" min="0" defaultValue={searchParams.maxExperience || ''} placeholder="Max exp" />
        <Input
          name="organisation"
          defaultValue={organisationLocked ? '' : searchParams.organisation || ''}
          disabled={organisationLocked}
          placeholder="Company"
        />
        <SelectField
          name="sort"
          defaultValue={searchParams.sort || 'relevance'}
          options={[
            { value: 'relevance', label: 'Relevance' },
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'closing_date', label: 'Closing date' },
            { value: 'salary_high', label: 'Salary high to low' },
          ]}
        />
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <label htmlFor="fresherFriendly" className="text-sm text-[var(--color-text-secondary)]">
            Fresher friendly
          </label>
          <input
            id="fresherFriendly"
            name="fresherFriendly"
            type="checkbox"
            defaultChecked={searchParams.fresherFriendly === 'true'}
            className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.22)]"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={action} className="rounded-full border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
          Reset filters
        </a>
      </div>
    </form>
  );
}
