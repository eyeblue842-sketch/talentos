import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminSettings } from '@/lib/api';
import { updateAdminSettingsAction } from '../actions';

export default async function AdminSettingsPage() {
  let settings = null;
  let error = '';
  try {
    settings = await getAdminSettings();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Organization settings" title="Configure organization settings and defaults" description="Update timezone, currency, language, date format, experience bands, and organization-level branding settings." breadcrumb={[{ label: 'Admin' }, { label: 'Settings' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {settings ? (
        <Card>
          <form action={updateAdminSettingsAction} className="grid gap-3 text-sm md:grid-cols-2">
            <input name="timezone" defaultValue={settings.timezone || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Timezone" />
            <input name="currency" defaultValue={settings.currency || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Currency" />
            <input name="language" defaultValue={settings.language || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Language" />
            <input name="dateFormat" defaultValue={settings.dateFormat || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Date format" />
            <input name="employmentTypes" defaultValue={(settings.employmentTypes || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Employment types, comma separated" />
            <input name="workModes" defaultValue={(settings.workModes || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Work modes, comma separated" />
            <textarea name="experienceBands" defaultValue={JSON.stringify(settings.experienceBands || [], null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Experience bands JSON" />
            <textarea name="careerPageSettings" defaultValue={JSON.stringify(settings.careerPageSettings || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Career page settings JSON" />
            <textarea name="emailBranding" defaultValue={JSON.stringify(settings.emailBranding || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Email branding JSON" />
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white md:col-span-2">Save settings</button>
          </form>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}
