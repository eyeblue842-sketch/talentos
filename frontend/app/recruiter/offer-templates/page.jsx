import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { OfferTemplatesManager } from '@/components/recruiter/offer-templates-manager';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getRecruiterOfferTemplates } from '@/lib/api';

export default async function RecruiterOfferTemplatesPage() {
  let organisation = null;
  let templates = [];
  let error = '';
  try {
    [organisation, templates] = await Promise.all([
      getCurrentOrganisation(),
      getRecruiterOfferTemplates(),
    ]);
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} brandLogoUrl={organisation?.logoUrl} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation?.slug || 'Recruiter'}
        title="Offer Templates"
        description="Editable offer-letter templates. Pick one when creating an offer — the form fields merge into the letter to produce a downloadable offer."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Offer Templates' }]}
      />
      {error ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card> : null}
      <OfferTemplatesManager initialTemplates={templates} />
    </WorkspaceShell>
  );
}
