import { Sidebar } from '@/components/layout/sidebar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/mock-data';
import { getOrganisationMembers } from '@/lib/api';

export default async function RecruiterMembersPage() {
  let members = [];
  let error = '';

  try {
    members = await getOrganisationMembers();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Hiring Ops" items={recruiterNav} />
      <section className="space-y-6">
        <Card>
          <h1 className="font-[var(--font-display)] text-3xl font-semibold">Organisation members</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Owner and admin users can manage membership status and organisation roles from the backend API.</p>
          {error ? <p className="mt-4 text-sm text-[var(--muted)]">{error}</p> : null}
          {!error && members.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">No members found for this organisation.</p> : null}
          {!error && members.length > 0 ? (
            <div className="mt-5 space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4 text-sm">
                  <div>
                    <p className="font-semibold">{member.user?.email}</p>
                    <p className="text-[var(--muted)]">Membership created {new Date(member.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone="brand">{member.role}</Badge>
                    <Badge tone={member.status === 'ACTIVE' ? 'success' : 'warning'}>{member.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
