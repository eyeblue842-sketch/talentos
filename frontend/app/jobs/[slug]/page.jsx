import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PublicJobApplyAction } from '@/components/sections/public-job-apply-action';
import { getCurrentUser } from '@/lib/auth';
import { getPublicJob, getPublicJobApplyContext } from '@/lib/api';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';

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
    return {
      title: 'Job not found | Careeriz',
    };
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
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-[32px] p-7">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{job.workplaceType || 'Flexible'}</Badge>
            <Badge>{job.employmentType.replaceAll('_', ' ')}</Badge>
          </div>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold">{job.title}</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{job.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {job.skillsRequired.map((skill) => (
              <span key={skill} className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">{skill}</span>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div>
              <h2 className="font-semibold">Responsibilities</h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {(job.responsibilities.length ? job.responsibilities : ['See the detailed job description and team expectations during the application process.']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-semibold">Requirements</h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {(job.requirements.length ? job.requirements : ['Relevant experience, communication, and role-aligned skills are expected.']).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8">
            <h2 className="font-semibold">Benefits</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {(job.benefits.length ? job.benefits : ['Benefits will be shared by the employer during later hiring stages when configured publicly.']).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[32px] p-6">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">About the employer</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{job.organisation?.name || 'Careeriz employer'}</p>
            {job.organisation?.slug ? (
              <Link href={`/companies/${job.organisation.slug}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">
                View careers page
              </Link>
            ) : null}
          </Card>
          <Card className="rounded-[32px] p-6">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Next steps</h2>
            <div className="mt-4 space-y-3">
              {user?.role === 'CANDIDATE' ? (
                <>
                  <form action={job.saved ? unsaveJobAction : saveJobAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="redirectTo" value={`/jobs/${job.slug}`} />
                    <button type="submit" className="w-full rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">
                      {job.saved ? 'Remove from saved jobs' : 'Save this job'}
                    </button>
                  </form>
                  <PublicJobApplyAction user={user} eligibility={eligibility} slug={job.slug} />
                </>
              ) : (
                <PublicJobApplyAction user={user} eligibility={eligibility} slug={job.slug} />
              )}
            </div>
            <div id="apply" className="mt-6 rounded-[24px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              {eligibility.reasonCode ? `Application status: ${eligibility.reasonCode}.` : 'Applications are open for eligible candidates.'}
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-[var(--font-display)] text-3xl font-semibold">Similar jobs</h2>
        {similarJobs.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {similarJobs.map((item) => (
              <PublicJobCard key={item.id} job={item} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">No similar public jobs are available right now.</p>
        )}
      </section>
    </main>
  );
}
