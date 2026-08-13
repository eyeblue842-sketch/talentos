import Link from 'next/link';
import { Globe, MapPin, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getInitials(value) {
  return String(value || 'Careeriz')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function buildTabHref(basePath, tab) {
  return tab === 'home' ? basePath : `${basePath}?tab=${tab}`;
}

function CompanyLogo({ organisation }) {
  if (organisation?.logoUrl) {
    return (
      <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/35 bg-white shadow-sm">
        <img src={organisation.logoUrl} alt={`${organisation.name} logo`} className="h-full w-full object-cover object-center" />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/35 bg-white text-2xl font-semibold text-[var(--color-primary)] shadow-sm">
      {getInitials(organisation?.name)}
    </div>
  );
}

export function CompanyHeaderCard({
  organisation,
  basePath,
  activeTab,
  mode = 'public',
  canEdit = false,
}) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'people', label: 'People' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden rounded-2xl border-[var(--color-border)] p-0">
        <div className="bg-[linear-gradient(135deg,#f2ebff_0%,#ffffff_58%,#efe8ff_100%)] px-6 py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <CompanyLogo organisation={organisation} />
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">{organisation?.name || 'Organisation'}</h1>
                    {canEdit ? (
                      <Button as="a" href="/recruiter/onboarding" variant="outline" size="sm" className="gap-2">
                        <Pencil size={14} aria-hidden="true" />
                        Edit company profile
                      </Button>
                    ) : null}
                    {organisation?.website ? (
                      <Button as="a" href={organisation.website} variant="outline" size="sm" className="gap-2" target="_blank" rel="noreferrer">
                        <Globe size={14} aria-hidden="true" />
                        Company website
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{organisation?.industry || 'Industry not added'}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="inline-flex items-center gap-2">
                      <MapPin size={15} aria-hidden="true" />
                      {organisation?.headquarters || 'Primary location not added'}
                    </span>
                    {organisation?.organisationSize ? <Badge tone="neutral">{organisation.organisationSize}</Badge> : null}
                  </div>
                </div>
              </div>
            </div>
            {mode === 'recruiter' ? (
              <div className="text-sm text-[var(--color-text-secondary)]">
                <p className="font-medium text-[var(--color-text)]">Profile updated</p>
                <p className="mt-1">{formatDate(organisation?.updatedAt)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] pb-2 text-sm">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={buildTabHref(basePath, tab.id)}
              className={active
                ? 'rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 font-medium text-[var(--color-primary)]'
                : 'rounded-lg px-3 py-2 text-[var(--color-text-secondary)] transition hover:bg-white hover:text-[var(--color-text)]'}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CompanyAboutSection({ organisation, canEdit = false, preview = false }) {
  const description = organisation?.publicDescription || organisation?.cultureSummary || 'Add an organisation overview to help people understand your company.';

  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">About</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
        {canEdit ? <Button as="a" href="/recruiter/onboarding" variant="outline" size="sm">Edit</Button> : null}
      </div>
      {!preview ? (
        <dl className="mt-6 grid gap-4 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
          <div><dt className="font-semibold text-[var(--color-text)]">Industry</dt><dd>{organisation?.industry || 'Not added'}</dd></div>
          <div><dt className="font-semibold text-[var(--color-text)]">Company size</dt><dd>{organisation?.organisationSize || 'Not added'}</dd></div>
          <div><dt className="font-semibold text-[var(--color-text)]">Headquarters</dt><dd>{organisation?.headquarters || 'Not added'}</dd></div>
          <div><dt className="font-semibold text-[var(--color-text)]">Website</dt><dd>{organisation?.website || 'Not added'}</dd></div>
          <div><dt className="font-semibold text-[var(--color-text)]">Locations</dt><dd>{organisation?.publicLocations?.length ? organisation.publicLocations.join(', ') : 'Not added'}</dd></div>
          <div><dt className="font-semibold text-[var(--color-text)]">Culture</dt><dd>{organisation?.cultureSummary || 'Not added'}</dd></div>
        </dl>
      ) : null}
    </Card>
  );
}

export function CompanyPostsSection({ organisation, posts = [], canManage = false, createPostAction = null }) {
  return (
    <Card className="rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Latest from {organisation?.name || 'this company'}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Published company updates and hiring highlights.</p>
        </div>
      </div>

      {canManage && createPostAction ? (
        <form action={createPostAction} className="mt-5 grid gap-3 rounded-xl border border-[var(--color-border)] p-4">
          <input type="hidden" name="organisationSlug" value={organisation?.slug || ''} />
          <textarea
            name="content"
            className="min-h-28 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm"
            placeholder="Share a company update"
            required
          />
          <div className="flex justify-end">
            <Button type="submit">Create post</Button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 grid gap-4">
        {posts.length ? posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]">
                {getInitials(organisation?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--color-text)]">{organisation?.name}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatDate(post.publishedAt || post.createdAt)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)]">{post.content}</p>
          </article>
        )) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No published company updates yet.</p>
        )}
      </div>
    </Card>
  );
}

export function CompanyJobsSection({ jobs = [], title = 'Job openings', companyName = 'This company' }) {
  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      {jobs.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-xl border border-[var(--color-border)] p-4">
              <h3 className="text-base font-semibold text-[var(--color-text)]">{job.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{job.location || 'Location not added'}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {[job.employmentType?.replaceAll('_', ' '), job.workplaceType?.replaceAll('_', ' ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {job.experienceMin != null || job.experienceMax != null
                  ? `${job.experienceMin ?? 0}-${job.experienceMax ?? job.experienceMin ?? 0} Years`
                  : 'Experience not added'}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Posted {formatDate(job.postedAt || job.createdAt)}</p>
              {job.skillsRequired?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.skillsRequired.slice(0, 5).map((skill) => (
                    <Badge key={`${job.id}-${skill}`} tone="neutral">{skill}</Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-4">
                <Link href={`/jobs/${job.slug}`} className="text-sm font-medium text-[var(--color-primary)]">View Job</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-text-secondary)]">
          <p className="font-medium text-[var(--color-text)]">No current openings</p>
          <p className="mt-2">There are no active job openings at {companyName} right now.</p>
        </div>
      )}
    </Card>
  );
}

export function CompanyPeoplePreview({ peopleInsights, basePath }) {
  const topLocation = peopleInsights?.locations?.[0];
  const topEducation = peopleInsights?.education?.[0];
  const topRole = peopleInsights?.roles?.[0];

  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">People highlights</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {peopleInsights?.sampleSize >= 5
              ? `Insights based on ${peopleInsights.sampleSize} Careeriz profiles that currently list this company as their employer.`
              : 'Not enough Careeriz profile data is available yet to display workforce insights.'}
          </p>
        </div>
        <Link href={buildTabHref(basePath, 'people')} className="text-sm font-medium text-[var(--color-primary)]">Explore people insights</Link>
      </div>
      {peopleInsights?.sampleSize >= 5 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Top location</p>
            <p className="mt-2 font-semibold text-[var(--color-text)]">{topLocation ? `${topLocation.label} (${topLocation.count})` : 'Not available'}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Most common background</p>
            <p className="mt-2 font-semibold text-[var(--color-text)]">{topEducation?.label || 'Not available'}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Popular role</p>
            <p className="mt-2 font-semibold text-[var(--color-text)]">{topRole?.label || 'Not available'}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function DistributionList({ title, items = [], suffix = '' }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => (
          <div key={`${title}-${item.label}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-secondary)]">{item.label}</span>
            <span className="font-medium text-[var(--color-text)]">{item.count}{suffix}</span>
          </div>
        )) : <p className="text-sm text-[var(--color-text-secondary)]">Not enough data</p>}
      </div>
    </div>
  );
}

export function CompanyPeopleInsightsSection({ organisation, peopleInsights }) {
  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">People insights</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {peopleInsights?.sampleSize >= 5
              ? `Insights based on ${peopleInsights.sampleSize} Careeriz profiles currently listing ${organisation?.name} as their employer.`
              : peopleInsights?.insufficientDataMessage || 'Not enough Careeriz profile data is available yet to display workforce insights.'}
          </p>
        </div>
      </div>

      {peopleInsights?.sampleSize >= 5 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DistributionList title="Where employees are based" items={peopleInsights.locations} />
          <DistributionList title="Education background" items={peopleInsights.education} />
          <DistributionList title="Roles" items={peopleInsights.roles} />
          <DistributionList title="Experience levels" items={peopleInsights.experienceLevels} />
          <DistributionList title="Top skills" items={peopleInsights.skills} />
        </div>
      ) : null}
    </Card>
  );
}

export function CompanyInsightsSection({ publicInsights }) {
  return (
    <Card className="rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-[var(--color-text)]">Insights</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Active job count</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{publicInsights?.activeJobCount ?? 0}</p>
        </div>
        <DistributionList title="Hiring locations" items={publicInsights?.hiringLocations || []} />
        <DistributionList title="Common roles" items={publicInsights?.commonRoles || []} />
        <DistributionList title="Common skills" items={publicInsights?.commonSkills || []} />
      </div>
    </Card>
  );
}
