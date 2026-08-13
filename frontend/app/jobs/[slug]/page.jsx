import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BriefcaseBusiness,
  Building2,
  Clock3,
  MapPin,
  Wallet,
} from 'lucide-react';
import { sendConnectionRequestAction } from '@/app/network/actions';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PublicJobApplyAction } from '@/components/sections/public-job-apply-action';
import { CandidateJobViewTracker } from '@/components/sections/candidate-job-view-tracker';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';
import { getCurrentUser } from '@/lib/auth';
import { getPublicJob, getPublicJobApplyContext } from '@/lib/api';
import {
  formatApplicantCount,
  formatEmploymentLabel,
  formatJobExperienceRange,
  formatJobSalaryRange,
  formatRecruitmentDate,
} from '@/lib/recruitment-formatters';

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
      <Icon size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
      <span className="font-medium text-[var(--color-text)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BulletSection({ title, items, emptyLabel }) {
  return (
    <Card className="grid gap-4">
      <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
      {items?.length ? (
        <ul className="grid gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {items.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">{emptyLabel}</p>
      )}
    </Card>
  );
}

function RecruiterContactCard({ job, user }) {
  if (!job.recruiter?.userId) {
    return null;
  }

  return (
    <Card className="grid gap-4">
      <h2 className="text-xl font-semibold text-[var(--color-text)]">Recruiting contact</h2>
      <div>
        <p className="text-base font-semibold text-[var(--color-text)]">
          {job.recruiter.fullName}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {job.recruiter.designation || job.recruiter.headline || 'Recruiting team'}
          {job.recruiter.company ? ` - ${job.recruiter.company}` : ''}
        </p>
        {job.recruiter.location ? (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {job.recruiter.location}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/network/people/${job.recruiter.userId}`}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]"
        >
          View profile
        </Link>
        {user ? (
          job.recruiter.connectionStatus === 'NONE' ? (
            <form action={sendConnectionRequestAction}>
              <input type="hidden" name="targetUserId" value={job.recruiter.userId} />
              <input type="hidden" name="source" value="JOB" />
              <input type="hidden" name="redirectTo" value={`/jobs/${job.slug}`} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
              >
                Connect
              </button>
            </form>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]">
              {job.recruiter.connectionStatus === 'ACCEPTED'
                ? 'Connected'
                : 'Request pending'}
            </span>
          )
        ) : null}
      </div>
    </Card>
  );
}

export async function generateMetadata({ params }) {
  try {
    const { job } = await getPublicJob((await params).slug);
    return {
      title: `${job.title} at ${job.organisation?.name || 'Careeriz employer'} | Careeriz Jobs`,
      description: job.description.slice(0, 160),
      alternates: { canonical: `/jobs/${job.slug}` },
      openGraph: {
        title: `${job.title} at ${job.organisation?.name || 'Careeriz employer'}`,
        description: job.description.slice(0, 160),
        url: `/jobs/${job.slug}`,
      },
    };
  } catch {
    return { title: 'Job not found | Careeriz' };
  }
}

export default async function PublicJobDetailPage({ params }) {
  let data;
  try {
    data = await getPublicJob((await params).slug);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const user = await getCurrentUser();
  const { job, similarJobs } = data;
  const applyContext = await getPublicJobApplyContext(job.slug);
  const eligibility = applyContext.eligibility;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.postedAt,
    validThrough: job.applicationDeadline || undefined,
    employmentType: job.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.organisation?.name,
      sameAs: job.organisation?.website || undefined,
      logo: job.organisation?.logoUrl || undefined,
    },
    jobLocationType: job.workplaceType === 'REMOTE' ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: job.location,
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
      {user?.role === 'CANDIDATE' ? <CandidateJobViewTracker jobId={job.id} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="grid gap-6">
        <Card className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{formatEmploymentLabel(job.employmentType)}</Badge>
                {job.workplaceType ? (
                  <Badge tone="neutral">
                    {formatEmploymentLabel(job.workplaceType)}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--color-text)] md:text-4xl">
                {job.title}
              </h1>
              <Link
                href={job.organisation?.slug ? `/companies/${job.organisation.slug}` : '#'}
                className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--color-primary)]"
              >
                <Building2 size={18} aria-hidden="true" />
                {job.organisation?.name || 'Careeriz employer'}
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              {user?.role === 'CANDIDATE' ? (
                <form action={job.saved ? unsaveJobAction : saveJobAction}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="redirectTo" value={`/jobs/${job.slug}`} />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]"
                  >
                    {job.saved ? 'Saved' : 'Save'}
                  </button>
                </form>
              ) : null}
              <PublicJobApplyAction user={user} eligibility={eligibility} slug={job.slug} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailRow
              icon={BriefcaseBusiness}
              label="Experience"
              value={formatJobExperienceRange(job)}
            />
            <DetailRow
              icon={Wallet}
              label="Salary"
              value={formatJobSalaryRange(job)}
            />
            <DetailRow
              icon={MapPin}
              label="Location"
              value={job.location || 'Not specified'}
            />
            <DetailRow
              icon={Clock3}
              label="Posted"
              value={formatRecruitmentDate(job.postedAt || job.createdAt)}
            />
            <DetailRow
              icon={BriefcaseBusiness}
              label="Openings"
              value={`${job.numberOfOpenings || 1}`}
            />
            <DetailRow
              icon={BriefcaseBusiness}
              label="Applicants"
              value={formatApplicantCount(job.applicantsCount || job.applicationCount || 0)}
            />
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="grid gap-4" id="job-highlights">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Job Highlights
              </h2>
              <div className="flex flex-wrap gap-2">
                {(job.skillsRequired || []).slice(0, 10).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                {job.description}
              </p>
            </Card>

            <BulletSection
              title="Responsibilities"
              items={job.responsibilities}
              emptyLabel="Detailed responsibilities will be shared during the application and interview stages."
            />

            <BulletSection
              title="Desired Candidate Profile"
              items={job.requirements}
              emptyLabel="The employer has not published a detailed candidate profile yet."
            />

            <Card className="grid gap-4">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Role Details
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <DetailRow
                  icon={BriefcaseBusiness}
                  label="Department"
                  value={job.department || 'Not specified'}
                />
                <DetailRow
                  icon={BriefcaseBusiness}
                  label="Employment Type"
                  value={formatEmploymentLabel(job.employmentType)}
                />
                <DetailRow
                  icon={BriefcaseBusiness}
                  label="Workplace"
                  value={
                    job.workplaceType
                      ? formatEmploymentLabel(job.workplaceType)
                      : 'Not specified'
                  }
                />
                <DetailRow
                  icon={BriefcaseBusiness}
                  label="Industry / Unit"
                  value={job.businessUnit || 'Not specified'}
                />
              </div>
            </Card>

            <BulletSection
              title="Benefits"
              items={job.benefits}
              emptyLabel="Benefits will be discussed by the employer during later hiring stages."
            />

            <Card className="grid gap-4">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                About Company
              </h2>
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                {job.organisation?.publicDescription ||
                  'Visit the company page to learn more about the employer, active jobs, and public company insights.'}
              </p>
              {job.organisation?.slug ? (
                <Link
                  href={`/companies/${job.organisation.slug}`}
                  className="inline-flex text-sm font-semibold text-[var(--color-primary)]"
                >
                  View company page
                </Link>
              ) : null}
            </Card>
          </div>

          <div className="space-y-6">
            <RecruiterContactCard job={job} user={user} />

            <Card className="grid gap-4" id="apply">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Apply for this role
              </h2>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {eligibility.reasonCode
                  ? `Application status: ${eligibility.reasonCode}.`
                  : 'Applications are open for eligible candidates.'}
              </p>
              <PublicJobApplyAction
                user={user}
                eligibility={eligibility}
                slug={job.slug}
              />
            </Card>

            <Card className="grid gap-4">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Company Jobs
              </h2>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Explore more open roles from the same company.
              </p>
              {job.organisation?.slug ? (
                <Link
                  href={`/companies/${job.organisation.slug}?tab=jobs`}
                  className="inline-flex text-sm font-semibold text-[var(--color-primary)]"
                >
                  View all company jobs
                </Link>
              ) : null}
            </Card>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">
            More roles you may like
          </h2>
          {job.organisation?.slug ? (
            <Link
              href={`/companies/${job.organisation.slug}`}
              className="text-sm font-semibold text-[var(--color-primary)]"
            >
              Explore company page
            </Link>
          ) : null}
        </div>
        {similarJobs.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {similarJobs.map((item) => (
              <PublicJobCard key={item.id} job={item} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            No similar public jobs are available right now.
          </p>
        )}
      </section>
    </main>
  );
}
