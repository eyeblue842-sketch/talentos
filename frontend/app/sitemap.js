import { getPublicJobs, getPublicOrganisations } from '@/lib/api';

export default async function sitemap() {
  try {
    const firstPage = await getPublicJobs({ pageSize: 50, sort: 'newest' });
    const additionalPages = [];
    for (let page = 2; page <= firstPage.meta.pageCount; page += 1) {
      additionalPages.push(getPublicJobs({ pageSize: 50, page, sort: 'newest' }));
    }
    const [organisations, ...remainingPages] = await Promise.all([
      getPublicOrganisations(),
      ...additionalPages,
    ]);
    const jobs = [firstPage, ...remainingPages].flatMap((result) => result.items);

    return [
      { url: '/' },
      { url: '/jobs' },
      ...jobs.map((job) => ({
        url: `/jobs/${job.slug}`,
        lastModified: job.updatedAt || job.postedAt,
      })),
      ...organisations.map((organisation) => ({
        url: `/companies/${organisation.slug}`,
        lastModified: organisation.updatedAt,
      })),
    ];
  } catch {
    return [
      { url: '/' },
      { url: '/jobs' },
    ];
  }
}
