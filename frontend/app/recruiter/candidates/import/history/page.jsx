import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportHistoryExperience } from '@/components/resume-import/experience';
import { recruiterNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getCurrentOrganisation, getResumeImportBatches } from '@/lib/api';

export default async function RecruiterResumeImportHistoryPage({ searchParams }) {
  const query = await searchParams;
  const organisation = await getCurrentOrganisation().catch(() => null);
  const result = isFeatureEnabled('bulkResumeImport')
    ? await getResumeImportBatches(query || {}).catch(() => ({ items: [], meta: null }))
    : { items: [], meta: null };

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Candidate management'}
        title="Bulk Resume Import History"
        description="Track previous import batches, inspect outcomes, download failure reports, and reopen recruiter review queues."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Bulk Resume Import', href: '/recruiter/candidates/import' }, { label: 'History' }]}
        secondaryActions={[{ label: 'New import', href: '/recruiter/candidates/import' }]}
      />
      {isFeatureEnabled('bulkResumeImport') ? (
        <ResumeImportHistoryExperience
          initialItems={result.items || []}
          initialMeta={result.meta}
          initialQuery={query || {}}
          basePath="/recruiter/candidates/import"
          roleBasePath="/recruiter/candidates/import"
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/recruiter" />
      )}
    </WorkspaceShell>
  );
}

