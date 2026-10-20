import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { ProfileNameForm } from '@/components/recruiter/profile-name-form';

export default async function RecruiterSettingsPage() {
  let organisation = null;
  let currentUser = null;
  let error = '';

  try {
    currentUser = await getCurrentUser();
    organisation = await getCurrentOrganisation();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} brandLogoUrl={organisation?.logoUrl} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Organisation settings"
        description="Review the currently active recruiter workspace identity and high-level workspace configuration."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Settings' }]}
      />
        <Card className="mb-6">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Your profile</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">This name appears on your recruiter home page.</p>
          <ProfileNameForm initialName={currentUser?.name} email={currentUser?.email} />
        </Card>
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Workspace configuration</h2>
          {error ? <p className="mt-3 text-sm text-[var(--muted)]">{error}</p> : null}
          {!error && !organisation ? <p className="mt-3 text-sm text-[var(--muted)]">Loading organisation context.</p> : null}
          {organisation ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <p className="font-semibold">Name</p>
                <p className="text-[var(--muted)]">{organisation.name}</p>
              </div>
              <div>
                <p className="font-semibold">Slug</p>
                <p className="text-[var(--muted)]">{organisation.slug}</p>
              </div>
              <div>
                <p className="font-semibold">Status</p>
                <p className="text-[var(--muted)]">{organisation.status}</p>
              </div>
              <div>
                <p className="font-semibold">Website</p>
                <p className="text-[var(--muted)]">{organisation.website || 'Not configured'}</p>
              </div>
            </div>
          ) : null}
        </Card>
    </WorkspaceShell>
  );
}
