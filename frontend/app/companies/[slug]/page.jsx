import { notFound } from 'next/navigation';
import { CompanyAboutSection, CompanyHeaderCard, CompanyInsightsSection, CompanyJobsSection, CompanyPeopleInsightsSection, CompanyPeoplePreview, CompanyPostsSection } from '@/components/sections/company-profile-sections';
import { getPublicOrganisation } from '@/lib/api';

const COMPANY_TABS = new Set(['home', 'about', 'jobs', 'people', 'insights']);

export async function generateMetadata({ params }) {
  try {
    const data = await getPublicOrganisation((await params).slug);
    return {
      title: `${data.organisation.name} Careers | Careeriz`,
      description: data.organisation.publicDescription || `Browse public jobs from ${data.organisation.name} on Careeriz.`,
      alternates: { canonical: `/companies/${data.organisation.slug}` },
    };
  } catch {
    return { title: 'Company not found | Careeriz' };
  }
}

export default async function PublicOrganisationPage({ params, searchParams }) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const activeTab = COMPANY_TABS.has(String(queryParams?.tab || 'home')) ? String(queryParams?.tab || 'home') : 'home';

  let data;
  try {
    data = await getPublicOrganisation(routeParams.slug);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const { organisation, jobs, recentJobs, posts, peopleInsights, publicInsights } = data;
  const basePath = `/companies/${organisation.slug}`;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <div className="grid gap-6">
        <CompanyHeaderCard organisation={organisation} basePath={basePath} activeTab={activeTab} mode="public" />

        {activeTab === 'home' ? (
          <div className="grid gap-6">
            <CompanyAboutSection organisation={organisation} preview />
            <CompanyPostsSection organisation={organisation} posts={posts} />
            <CompanyJobsSection jobs={recentJobs} title="Recent job openings" companyName={organisation.name} />
            <CompanyPeoplePreview peopleInsights={peopleInsights} basePath={basePath} />
            <CompanyInsightsSection publicInsights={publicInsights} />
          </div>
        ) : null}

        {activeTab === 'about' ? <CompanyAboutSection organisation={organisation} /> : null}
        {activeTab === 'jobs' ? <CompanyJobsSection jobs={jobs.items} title="Open jobs" companyName={organisation.name} /> : null}
        {activeTab === 'people' ? <CompanyPeopleInsightsSection organisation={organisation} peopleInsights={peopleInsights} /> : null}
        {activeTab === 'insights' ? <CompanyInsightsSection publicInsights={publicInsights} /> : null}
      </div>
    </main>
  );
}
