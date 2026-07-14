import Link from 'next/link';
import { ArrowRight, Building2, Globe2, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';

const industryDomains = [
  'Manufacturing',
  'Hospitality',
  'Information Technology',
  'ITES / BPO',
  'Healthcare',
  'Pharmaceuticals',
  'Banking and Financial Services',
  'Insurance',
  'Retail',
  'E-commerce',
  'Logistics and Supply Chain',
  'Construction',
  'Real Estate',
  'Education',
  'Media and Entertainment',
  'Telecommunications',
  'Automotive',
  'Aviation',
  'Energy and Utilities',
  'FMCG',
  'Textiles',
  'Travel and Tourism',
  'Consulting',
  'Government / Public Sector',
  'Other',
];

const companyTypes = ['MNC', 'Domestic', 'Startup', 'Public Sector', 'Family Owned', 'Other'];
const employeeRanges = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];
const turnoverRanges = [
  'Below INR 1 Cr',
  'INR 1 Cr - 5 Cr',
  'INR 5 Cr - 25 Cr',
  'INR 25 Cr - 100 Cr',
  'INR 100 Cr - 500 Cr',
  'Above INR 500 Cr',
];

export default function RecruiterOnboardingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="bg-[#102418] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-white/56">Recruiter Step 2</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold">Complete the company profile before entering the recruiter workspace.</h1>
          <div className="mt-8 space-y-4 text-sm text-white/76">
            <div className="flex gap-3">
              <Building2 size={18} className="mt-1" />
              <span>Company identity, industry domain, office footprint, and team scale all live here.</span>
            </div>
            <div className="flex gap-3">
              <Globe2 size={18} className="mt-1" />
              <span>This is the right page to collect details like MNC or Domestic, headquarters, branches, and turnover.</span>
            </div>
            <div className="flex gap-3">
              <Users size={18} className="mt-1" />
              <span>The logged-in recruiter also records current designation and working-since year here.</span>
            </div>
          </div>
          <div className="mt-10 rounded-[24px] border border-white/10 bg-white/6 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">Profile checklist</p>
            <div className="mt-4 grid gap-3 text-sm text-white/76">
              <div>Company name and about the company</div>
              <div>Industry domain and company type</div>
              <div>Headquarter, branches, office locations, employee size, turnover</div>
              <div>Recruiter designation and working since</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Company onboarding</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Company details</h2>
            </div>
            <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Required after recruiter signup</span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Company name" />
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option>Industry domain</option>
              {industryDomains.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <textarea className="min-h-28 rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="About the company" />
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option>Company type</option>
              {companyTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Headquarter location" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Started in year" />
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option>Current employee count</option>
              {employeeRanges.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Number of branches / offices" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Office locations (comma separated)" />
            <select className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option>Annual turnover</option>
              {turnoverRanges.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Current designation" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Working since year" />
            <input className="rounded-2xl border border-[var(--line)] px-4 py-3 md:col-span-2" placeholder="Company website (optional)" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">
              Save company profile <ArrowRight size={16} />
            </button>
            <Link href="/recruiter" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">
              Skip to recruiter dashboard
            </Link>
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            <div className="flex gap-3">
              <MapPin size={16} className="mt-1 text-[var(--brand)]" />
              <p>
                These fields map to the recruiter onboarding API so the company profile can be stored after signup and before job posting begins.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
