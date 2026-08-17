import Link from 'next/link';
import { PublicHeader } from '@/components/public/public-header';
import { PricingCards } from '@/components/billing/pricing-cards';
import { Button } from '@/components/ui/button';
import { getBillingCatalogue } from '@/lib/api';

export const metadata = {
  title: 'Pricing - Careeriz',
};

export default async function PricingPage() {
  const catalogue = await getBillingCatalogue();

  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-md)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Pricing</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            Simple, transparent hiring plans.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            Post jobs, search the resume database, and run your applicant pipeline in one workspace. All prices are in INR and include 18% GST.
          </p>
        </section>

        <section className="mt-8">
          <PricingCards
            products={catalogue.products}
            renderAction={(product) => (
              <Button as={Link} href="/recruiter/billing" className="w-full">
                {product.code === 'JOB_POST_45D' ? 'Buy a job credit' : 'Get started'}
              </Button>
            )}
          />
        </section>

        <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-6 text-sm leading-6 text-[var(--color-text-secondary)] md:p-8">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">How job-posting credits work</h2>
          <p className="mt-3">
            Every activated job stays live on Careeriz for 45 days from the moment it is published, then automatically closes. A single job-posting
            credit activates exactly one job. ATS + Resume Database plans include a set number of job-posting credits for the duration of the plan
            - publishing beyond that number requires purchasing an additional job-posting credit.
          </p>
          <p className="mt-3">
            Sign in to your Careeriz recruiter workspace and open Billing to purchase a plan, track your remaining credits, and manage your
            subscription.
          </p>
        </section>
      </main>
    </>
  );
}
