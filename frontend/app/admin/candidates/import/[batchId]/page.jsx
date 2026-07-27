import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportBatchDetailExperience } from '@/components/resume-import/experience';
import { adminNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { getResumeImportBatch, getResumeImportBatchItems } from '@/lib/api';

export default async function AdminResumeImportBatchPage({ params, searchParams }) {
  const { batchId } = await params;
  const query = await searchParams;

  let batch = null;
  let items = [];
  let meta = null;

  if (isFeatureEnabled('bulkResumeImport')) {
    [batch, { items, meta }] = await Promise.all([
      getResumeImportBatch(batchId).catch(() => null),
      getResumeImportBatchItems(batchId, { ...(query || {}), pageSize: query?.pageSize || 100 }).catch(() => ({ items: [], meta: null })),
    ]);
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader
        eyebrow="Candidate management"
        title={batch ? `Import batch ${batch.id}` : 'Import batch'}
        description="Track item-level processing, retry failures, and open the review flow from the admin workspace."
        breadcrumb={[
          { label: 'Admin' },
          { label: 'Bulk Resume Import', href: '/admin/candidates/import' },
          { label: 'History', href: '/admin/candidates/import/history' },
          { label: batchId },
        ]}
      />
      {isFeatureEnabled('bulkResumeImport') && batch ? (
        <ResumeImportBatchDetailExperience
          initialBatch={batch}
          initialItems={items || []}
          initialMeta={meta}
          initialQuery={query || {}}
          batchId={batchId}
          historyHref="/admin/candidates/import/history"
          itemHrefBase={`/admin/candidates/import/${batchId}/items`}
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/admin/candidates/import/history" />
      )}
    </WorkspaceShell>
  );
}

