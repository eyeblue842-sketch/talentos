import { Suspense } from 'react';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { platformNav } from '@/lib/navigation';
import { LinkedInConsole } from '@/components/platform/linkedin-console';

// Access is enforced by app/platform/layout.jsx (backend super-admin check) and,
// again, by the backend on every API call this console makes.
export default function PlatformLinkedInPage() {
  return (
    <WorkspaceShell brand="Careeriz Platform" items={platformNav}>
      <PageHeader
        eyebrow="Platform"
        title="LinkedIn distribution"
        description="Platform-owned LinkedIn profiles, automatic job distribution, publication history and candidate-acquisition attribution."
        breadcrumb={[{ label: 'Platform' }, { label: 'LinkedIn' }]}
      />
      <Suspense fallback={null}>
        <LinkedInConsole />
      </Suspense>
    </WorkspaceShell>
  );
}
