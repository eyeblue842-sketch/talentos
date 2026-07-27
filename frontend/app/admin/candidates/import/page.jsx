import { PageHeader } from '@/components/ui/page-header';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ResumeImportFeatureUnavailable } from '@/components/resume-import/feature-unavailable';
import { ResumeImportUploadExperience } from '@/components/resume-import/experience';
import { adminNav } from '@/lib/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';

function getLimits() {
  return {
    maxFiles: Number(process.env.RESUME_IMPORT_MAX_FILES || 100),
    maxFileSizeMb: Number(process.env.RESUME_MAX_FILE_SIZE_MB || 10),
    maxZipSizeMb: Number(process.env.RESUME_IMPORT_MAX_ZIP_SIZE_MB || 100),
    maxFileSizeBytes: Number(process.env.RESUME_MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
    maxZipSizeBytes: Number(process.env.RESUME_IMPORT_MAX_ZIP_SIZE_MB || 100) * 1024 * 1024,
  };
}

export default function AdminResumeImportPage() {
  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader
        eyebrow="Candidate management"
        title="Bulk Resume Import"
        description="Create batch uploads for talent-database resumes, then review and resolve imported records with the same backend contract used by recruiters."
        breadcrumb={[{ label: 'Admin' }, { label: 'Bulk Resume Import' }]}
        secondaryActions={[{ label: 'Import history', href: '/admin/candidates/import/history' }]}
      />
      {isFeatureEnabled('bulkResumeImport') ? (
        <ResumeImportUploadExperience
          limits={getLimits()}
          batchHrefPrefix="/admin/candidates/import"
          historyHref="/admin/candidates/import/history"
        />
      ) : (
        <ResumeImportFeatureUnavailable backHref="/admin" />
      )}
    </WorkspaceShell>
  );
}

