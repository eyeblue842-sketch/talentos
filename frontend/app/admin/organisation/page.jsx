import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminOrganisation } from '@/lib/api';
import {
  archiveAdminOrganisationAction,
  archiveAdminOrganisationUnitAction,
  saveAdminOrganisationUnitAction,
  updateAdminOrganisationAction,
} from '../actions';

export default async function AdminOrganisationPage() {
  let data = null;
  let error = '';
  try {
    data = await getAdminOrganisation();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={data?.organisation?.name || 'Enterprise Admin'} items={adminNav}>
      <PageHeader eyebrow="Organization management" title="Manage organization profile and structure" description="Update profile, branding, and reusable organization structure nodes without breaking tenant isolation." breadcrumb={[{ label: 'Admin' }, { label: 'Organisation' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {data ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Organization profile</h2>
            <form action={updateAdminOrganisationAction} className="mt-5 grid gap-3 text-sm">
              <input name="name" defaultValue={data.organisation?.name || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Organisation name" />
              <input name="slug" defaultValue={data.organisation?.slug || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Workspace slug" />
              <input name="website" defaultValue={data.organisation?.website || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Website" />
              <input name="logoUrl" defaultValue={data.organisation?.logoUrl || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Logo URL" />
              <input name="industry" defaultValue={data.organisation?.industry || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Industry" />
              <input name="organisationSize" defaultValue={data.organisation?.organisationSize || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Organisation size" />
              <input name="headquarters" defaultValue={data.organisation?.headquarters || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Headquarters" />
              <input name="publicLocations" defaultValue={(data.organisation?.publicLocations || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Public locations, comma separated" />
              <textarea name="publicDescription" defaultValue={data.organisation?.publicDescription || ''} className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Public description" />
              <textarea name="cultureSummary" defaultValue={data.organisation?.cultureSummary || ''} className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Culture summary" />
              <textarea name="benefitsSummary" defaultValue={data.organisation?.benefitsSummary || ''} className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Benefits summary" />
              <label className="flex items-center gap-2"><input type="checkbox" name="careersEnabled" defaultChecked={data.organisation?.careersEnabled} /> Careers enabled</label>
              <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white">Save organization profile</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Archive or restore</h2>
            <form action={archiveAdminOrganisationAction} className="mt-5 grid gap-3 text-sm">
              <input type="hidden" name="restore" value={data.organisation?.status === 'ACTIVE' ? 'false' : 'true'} />
              <button type="submit" className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold">{data.organisation?.status === 'ACTIVE' ? 'Archive organization' : 'Restore organization'}</button>
            </form>
          </Card>
          <Card className="xl:col-span-2">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Organization structure</h2>
            <div className="mt-5 grid gap-3">
              {(data.units || []).map((unit) => (
                <div key={unit.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{unit.name}</p>
                      <p className="text-[var(--muted)]">{unit.type} {unit.code ? `| ${unit.code}` : ''}</p>
                    </div>
                    <form action={archiveAdminOrganisationUnitAction.bind(null, unit.id, unit.status !== 'ACTIVE')}>
                      <button type="submit" className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold">{unit.status === 'ACTIVE' ? 'Archive' : 'Restore'}</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <form action={saveAdminOrganisationUnitAction} className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <select name="type" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="DEPARTMENT">
                {['BUSINESS_UNIT','DEPARTMENT','DIVISION','OFFICE_LOCATION','COST_CENTER','LEGAL_ENTITY'].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input name="name" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Unit name" />
              <input name="code" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Code" />
              <input name="parentId" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Parent unit id (optional)" />
              <textarea name="description" className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Description" />
              <textarea name="metadata" className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder='Metadata JSON, e.g. {"city":"Bengaluru"}' />
              <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white md:col-span-2">Add structure node</button>
            </form>
          </Card>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
