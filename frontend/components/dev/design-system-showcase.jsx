"use client";

import { useState } from 'react';
import { Bell, BriefcaseBusiness, CheckCircle2, FolderSearch, Sparkles, UserRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions, FormSection, SearchInput, VerificationCodeInput } from '@/components/ui/form-layout';
import { Input, PasswordField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { RadioGroup } from '@/components/ui/radio-group';
import { SectionHeader } from '@/components/ui/section-header';
import { CardSkeleton, MetricSkeleton, ProfileSkeleton, TableRowSkeleton, TextSkeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';

export function DesignSystemShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { push } = useToast();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
      <PageHeader
        eyebrow="Development only"
        title="Careeriz Design System Foundation"
        description="Reference states for reusable UI primitives, dashboard building blocks, and workspace patterns."
        breadcrumb={[
          { label: 'Dev' },
          { label: 'Design System' },
        ]}
        primaryAction={{ label: 'Show Toast', icon: Sparkles, onClick: () => push({ title: 'Design system ready', description: 'Reusable primitives are available for future page work.', tone: 'success' }) }}
        secondaryActions={[
          { label: 'Open Modal', onClick: () => setDialogOpen(true) },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Buttons" description="Primary actions, secondary controls, links, and loading states." />
          <div className="mt-5 flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link action</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Notifications"><Bell size={16} aria-hidden="true" /></Button>
            <Button loading>Loading</Button>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Badges and Alerts" description="Consistent status presentation and inline messaging." />
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="purple">Purple</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            <Alert tone="success" title="Candidate profile updated">Fields were saved without changing any server contracts.</Alert>
            <Alert tone="warning" title="Verification pending">Email verification UX remains unchanged in this phase.</Alert>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <SectionHeader title="Inputs and Forms" description="Shared controls for authentication, profile editing, and future AI workflows." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input label="Email" placeholder="name@company.com" helpText="Company email recommended for recruiter accounts." />
            <PasswordField label="Password" placeholder="Enter password" />
            <Input label="Search" placeholder="Search candidates or jobs" leadingIcon={FolderSearch} />
            <Select label="Role" defaultValue="candidate">
              <option value="candidate">Candidate</option>
              <option value="recruiter">Recruiter</option>
            </Select>
            <Textarea label="Summary" placeholder="Write a short summary..." className="md:col-span-2" />
            <Input label="Error state" placeholder="Broken input" error="This field is required." />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Checkbox label="Enable notifications" defaultChecked />
            <Checkbox label="Receive product updates" />
          </div>
          <div className="mt-5">
            <RadioGroup
              legend="Workspace"
              defaultValue="candidate"
              options={[
                { value: 'candidate', label: 'Candidate', description: 'Candidate-only navigation and profile tools.' },
                { value: 'recruiter', label: 'Recruiter', description: 'Recruiter workflows with ATS and organization context.' },
              ]}
            />
          </div>
          <div className="mt-5">
            <VerificationCodeInput />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Avatars and Loading" description="Identity markers, spinners, and skeletons." />
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Avatar name="Careeriz Candidate" size="sm" />
            <Avatar name="Recruiter Ops" size="md" status="online" />
            <Avatar name="Admin Workspace" size="lg" status="busy" />
            <Avatar name="Talent Intelligence" size="xl" />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          <div className="mt-6 grid gap-4">
            <TextSkeleton />
            <MetricSkeleton />
            <ProfileSkeleton />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Tabs and Empty States" description="Content switching and zero-data states." />
          <div className="mt-5">
            <Tabs
              items={[
                { value: 'candidate', label: 'Candidate', content: <p className="text-sm text-[var(--color-text-secondary)]">Candidate-facing workflows remain separate from recruiter workflows.</p> },
                { value: 'recruiter', label: 'Recruiter', content: <p className="text-sm text-[var(--color-text-secondary)]">Recruiter pages continue to depend on organization membership checks.</p> },
              ]}
            />
          </div>
          <div className="mt-6">
            <EmptyState
              icon={BriefcaseBusiness}
              title="No matching jobs"
              description="Try widening filters or saving a search once recruiter publishing expands."
              primaryAction={{ label: 'Browse jobs', href: '/jobs' }}
              secondaryAction={{ label: 'Dismiss', onClick: () => {} }}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Stats and Shell Blocks" description="Dashboard building blocks for candidate, recruiter, and admin workspaces." />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StatCard label="Active jobs" value="24" helper="Across recruiter workspaces" icon={BriefcaseBusiness} trend={{ direction: 'up', value: '+12%' }} />
            <StatCard label="Unread alerts" value="8" helper="Candidate and recruiter notifications" icon={Bell} trend={{ direction: 'down', value: '-4%' }} />
          </div>
          <div className="mt-6 grid gap-4">
            <CardSkeleton />
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Table row skeleton</p>
              <div className="mt-3">
                <TableRowSkeleton columns={4} />
              </div>
            </div>
          </div>
        </Card>
      </section>

      <FormSection title="Tooltips and Actions" description="Supporting micro-interactions should stay subtle and accessible.">
        <div className="flex flex-wrap items-center gap-4">
          <Tooltip content="This tooltip respects keyboard focus and stays intentionally compact.">
            <Button variant="outline">Hover or focus me</Button>
          </Tooltip>
          <FormActions>
            <Button variant="outline">Secondary action</Button>
            <Button>Primary action</Button>
          </FormActions>
        </div>
      </FormSection>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Accessible Modal"
        description="Escape closes the dialog and focus stays trapped while it is open."
      >
        <div className="grid gap-4">
          <Alert tone="info" title="Dialog pattern">Use this for confirmations, previews, and future AI-assisted flows.</Alert>
          <Input label="Dialog input" placeholder="Focusable field" />
          <FormActions>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button leadingIcon={CheckCircle2} onClick={() => setDialogOpen(false)}>Confirm</Button>
          </FormActions>
        </div>
      </Dialog>
    </main>
  );
}
