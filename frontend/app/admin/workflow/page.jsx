import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminWorkflow } from '@/lib/api';
import { updateAdminWorkflowAction } from '../actions';

export default async function AdminWorkflowPage() {
  let workflow = null;
  let error = '';
  try {
    workflow = await getAdminWorkflow();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Workflow administration" title="Configure organization workflows" description="Manage application stages, interview pipeline defaults, offer workflow defaults, and reusable workflow templates." breadcrumb={[{ label: 'Admin' }, { label: 'Workflow' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      {workflow ? (
        <Card>
          <form action={updateAdminWorkflowAction} className="grid gap-3 text-sm">
            <input name="applicationStages" defaultValue={(workflow.applicationStages || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Application stages, comma separated" />
            <input name="interviewPipeline" defaultValue={(workflow.interviewPipeline || []).join(', ')} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Interview pipeline, comma separated" />
            <textarea name="defaultHiringWorkflow" defaultValue={JSON.stringify(workflow.defaultHiringWorkflow || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Default hiring workflow JSON" />
            <textarea name="defaultOfferWorkflow" defaultValue={JSON.stringify(workflow.defaultOfferWorkflow || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Default offer workflow JSON" />
            <textarea name="interviewTemplates" defaultValue={JSON.stringify(workflow.interviewTemplates || [], null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Interview templates JSON" />
            <textarea name="offerTemplates" defaultValue={JSON.stringify(workflow.offerTemplates || [], null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Offer templates JSON" />
            <textarea name="defaultNotifications" defaultValue={JSON.stringify(workflow.notificationDefaults || {}, null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Default notifications JSON" />
            <textarea name="recruitmentTemplates" defaultValue={JSON.stringify(workflow.recruitmentTemplates || [], null, 2)} className="min-h-32 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Recruitment templates JSON" />
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save workflow administration</button>
          </form>
        </Card>
      ) : null}
    </WorkspaceShell>
  );
}
