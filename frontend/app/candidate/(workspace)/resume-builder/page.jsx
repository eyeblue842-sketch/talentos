import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { candidateNav } from '@/lib/navigation';
import { getResumeBuilderState } from '@/lib/api';

export default async function CandidateResumeBuilderPage() {
  const state = await getResumeBuilderState();

  return (
    <WorkspaceShell brand="Careeriz" items={candidateNav}>
      <PageHeader
        eyebrow="Resume Builder integration"
        title="Resume editing lives in the external Resume Builder product"
        description="Careeriz handles upload, parsing, metadata, and application resume selection. Resume creation and editing are intentionally separated."
        breadcrumb={[{ label: 'Candidate' }, { label: 'Resume Builder' }]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="rounded-[32px] p-6">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Careeriz responsibilities</h2>
          <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
            <p>Resume upload and version metadata</p>
            <p>Resume parsing status and suggested profile updates</p>
            <p>Primary resume selection for applications</p>
            <p>Secure recruiter access through applications and authorised flows</p>
          </div>
        </Card>

        <Card className="rounded-[32px] p-6">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Resume Builder responsibilities</h2>
          <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
            <p>Create and edit resume content</p>
            <p>Manage standalone resume variants</p>
            <p>Own future template, design, and export workflows</p>
          </div>
        </Card>

        <Card className="rounded-[32px] p-6 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">Integration state</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Current mode: {state.integrationMode}</p>
            </div>
            <div className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
              {state.enabled ? 'Configured' : 'Disabled'}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {state.links.create ? <a href={state.links.create} target="_blank" rel="noreferrer" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Create Resume</a> : null}
            {state.links.manage ? <a href={state.links.manage} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">Open Resume Builder</a> : null}
            <Link href="/candidate/resumes" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">Back to resume management</Link>
          </div>
          {!state.enabled ? <p className="mt-4 text-sm text-[var(--muted)]">{state.disabledReason}</p> : null}
        </Card>
      </div>
    </WorkspaceShell>
  );
}
