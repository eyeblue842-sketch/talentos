import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminNotificationTemplates } from '@/lib/api';
import { saveAdminNotificationTemplateAction } from '../actions';

export default async function AdminNotificationsPage() {
  let templates = [];
  let error = '';
  try {
    templates = await getAdminNotificationTemplates();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Notification administration" title="Manage notification templates" description="Control template subject/body content, channel, category, and enabled state using the current notification architecture." breadcrumb={[{ label: 'Admin' }, { label: 'Notifications' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Existing templates</h2>
          <div className="mt-5 space-y-3 text-sm">
            {templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">{template.key}</p>
                <p className="mt-1 text-[var(--muted)]">{template.category} | {template.channel} | {template.enabled ? 'Enabled' : 'Disabled'}</p>
                <p className="mt-3 text-[var(--muted)]">{template.preview}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Create or update template</h2>
          <form action={saveAdminNotificationTemplateAction} className="mt-5 grid gap-3 text-sm">
            <input name="id" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Existing template ID (optional)" />
            <input name="key" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Template key" />
            <select name="category" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="SYSTEM">
              {['ORGANISATION','MEMBERSHIP','REQUISITION','JOB','APPLICATION','INTERVIEW','FEEDBACK','SYSTEM'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="channel" className="rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="EMAIL">
              {['EMAIL','IN_APP'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input name="subject" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Subject" />
            <textarea name="body" className="min-h-40 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Body" />
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save template</button>
          </form>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
