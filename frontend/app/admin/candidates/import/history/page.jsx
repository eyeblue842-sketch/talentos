import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportHistoryExperience } from '@/components/resume-import/experience';
import { adminNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getResumeImportBatches } from '@/lib/api';

export default async function AdminResumeImportHistoryPage({ searchParams }) {
  const query = await searchParams;
  const result = isFeatureEnabled('bulkResumeImport')
    ? await getResumeImportBatches(query || {}).catch(() => ({ items: [], meta: null }))
    : { items: [], meta: null };

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader
        eyebrow="Candidate management"
        title="Bulk Resume Import History"
        description="Review historical resume-import batches, re-open failures, and inspect recruiter-grade review queues from the admin workspace."
        breadcrumb={[{ label: 'Admin' }, { label: 'Bulk Resume Import', href: '/admin/candidates/import' }, { label: 'History' }]}
      />
      {isFeatureEnabled('bulkResumeImport') ? (
        <ResumeImportHistoryExperience
          initialItems={result.items || []}
          initialMeta={result.meta}
          initialQuery={query || {}}
          basePath="/admin/candidates/import"
          roleBasePath="/admin/candidates/import"
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/admin" />
      )}
    </WorkspaceShell>
  );
}

