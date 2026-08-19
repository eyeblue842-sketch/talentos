import { notFound } from 'next/navigation';
import {
  CompanyAboutSection,
  CompanyHeaderCard,
  CompanyInsightsSection,
  CompanyJobsSection,
  CompanyPeopleInsightsSection,
  CompanyPeoplePreview,
  CompanyPostsSection,
} from '@/components/sections/company-profile-sections';
import { CompanyFollowToggle } from '@/components/network/network-page-content';
import { Card } from '@/components/ui/card';
import { sendConnectionRequestAction } from '@/app/network/actions';
import { getCurrentUser } from '@/lib/auth';
import { getPublicOrganisation } from '@/lib/api';

const COMPANY_TABS = new Set(['home', 'about', 'jobs', 'people', 'insights']);

function RecruitingTeamSection({ organisation, recruitingTeam = [], redirectTo }) {
  if (!recruitingTeam.length) {
    return null;
  }

  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Recruiting team</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Connect directly with recruiters currently hiring for {organisation?.name || 'this company'}.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {recruitingTeam.map((member) => (
          <article key={member.userId} className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="text-base font-semibold text-[var(--color-text)]">{member.fullName}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {member.designation || member.headline || 'Recruiter'}
              {member.company ? ` - ${member.company}` : ''}
            </p>
            {member.location ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{member.location}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/network/people/${member.userId}`}
                className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)]"
              >
                View profile
              </a>
              {member.connectionStatus === 'NONE' ? (
                <form action={sendConnectionRequestAction}>
                  <input type="hidden" name="targetUserId" value={member.userId} />
                  <input type="hidden" name="source" value="COMPANY" />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button
                    type="submit"
                    className="inline-flex min-h-10 items-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-medium text-white"
                  >
                    Connect
                  </button>
                </form>
              ) : null}
              {member.connectionStatus === 'PENDING' ? (
                <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text-secondary)]">
                  Pending
                </span>
              ) : null}
              {member.connectionStatus === 'ACCEPTED' ? (
                <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text-secondary)]">
                  Connected
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

export async function generateMetadata({ params }) {
  try {
    const data = await getPublicOrganisation((await params).slug);
    return {
      title: `${data.organisation.name} Careers | Careeriz`,
      description:
        data.organisation.publicDescription ||
        `Browse public jobs from ${data.organisation.name} on Careeriz.`,
      alternates: { canonical: `/companies/${data.organisation.slug}` },
    };
  } catch {
    return { title: 'Company not found | Careeriz' };
  }
}

export default async function PublicOrganisationPage({ params, searchParams }) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const activeTab = COMPANY_TABS.has(String(queryParams?.tab || 'home'))
    ? String(queryParams?.tab || 'home')
    : 'home';

  let data;
  try {
    data = await getPublicOrganisation(routeParams.slug);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const user = await getCurrentUser();
  const {
    organisation,
    jobs,
    recentJobs,
    posts,
    peopleInsights,
    publicInsights,
    recruitingTeam = [],
  } = data;
  const basePath = `/companies/${organisation.slug}`;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <div className="grid gap-6">
        <CompanyHeaderCard
          organisation={organisation}
          basePath={basePath}
          activeTab={activeTab}
          mode="public"
        />

        {user ? (
          <div className="flex justify-end">
            <CompanyFollowToggle
              organisationId={organisation.id}
              following={organisation.following}
              redirectTo={basePath}
            />
          </div>
        ) : null}

        {activeTab === 'home' ? (
          <div className="grid gap-6">
            <CompanyAboutSection organisation={organisation} preview />
            <CompanyPostsSection organisation={organisation} posts={posts} />
            <CompanyJobsSection
              jobs={recentJobs}
              title="Recent job openings"
              companyName={organisation.name}
            />
            <RecruitingTeamSection
              organisation={organisation}
              recruitingTeam={recruitingTeam}
              redirectTo={basePath}
            />
            <CompanyPeoplePreview peopleInsights={peopleInsights} basePath={basePath} />
            <CompanyInsightsSection publicInsights={publicInsights} />
          </div>
        ) : null}

        {activeTab === 'about' ? (
          <CompanyAboutSection organisation={organisation} />
        ) : null}
        {activeTab === 'jobs' ? (
          <CompanyJobsSection
            jobs={jobs.items}
            title="Open jobs"
            companyName={organisation.name}
          />
        ) : null}
        {activeTab === 'people' ? (
          <div className="grid gap-6">
            <RecruitingTeamSection
              organisation={organisation}
              recruitingTeam={recruitingTeam}
              redirectTo={basePath}
            />
            <CompanyPeopleInsightsSection
              organisation={organisation}
              peopleInsights={peopleInsights}
            />
          </div>
        ) : null}
        {activeTab === 'insights' ? (
          <CompanyInsightsSection publicInsights={publicInsights} />
        ) : null}
      </div>
    </main>
  );
}
