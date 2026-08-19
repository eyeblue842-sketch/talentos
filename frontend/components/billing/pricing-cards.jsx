import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPaise, PRODUCT_TAGLINES } from '@/lib/billing-format';

const CARD_ORDER = ['JOB_POST_45D', 'ATS_DB_1M', 'ATS_DB_6M', 'ATS_DB_12M'];

function taglineTone(tagline) {
  if (tagline === 'Best Value') return 'success';
  if (tagline === 'Popular') return 'brand';
  return 'neutral';
}

// Annual savings, computed strictly from base (pre-tax) prices only -
// section 12 explicitly warns against mixing pre-tax and post-tax figures
// in a savings comparison.
function annualBaseSavingsNote(byCode) {
  const monthly = byCode.get('ATS_DB_1M');
  const annual = byCode.get('ATS_DB_12M');
  if (!monthly || !annual) return null;
  const twelveMonthlyPayments = monthly.baseAmountPaise * 12;
  const saving = twelveMonthlyPayments - annual.baseAmountPaise;
  if (saving <= 0) return null;
  return `Save ${formatPaise(saving)} vs. paying monthly for 12 months (base price comparison).`;
}

export function PricingCards({ products, renderAction }) {
  const byCode = new Map(products.map((product) => [product.code, product]));
  const ordered = CARD_ORDER.map((code) => byCode.get(code)).filter(Boolean);
  const annualSavingsNote = annualBaseSavingsNote(byCode);

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {ordered.map((product) => {
        const tagline = PRODUCT_TAGLINES[product.code];
        const isAnnual = product.code === 'ATS_DB_12M';

        return (
          <Card
            key={product.code}
            variant={tagline === 'Popular' || isAnnual ? 'elevated' : 'default'}
            className="flex h-full flex-col gap-4 p-6"
          >
            <div className="flex min-h-6 items-center gap-2">
              {tagline ? <Badge tone={taglineTone(tagline)}>{tagline}</Badge> : null}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--color-text)]">{product.name}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{product.description}</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">{formatPaise(product.totalAmountPaise)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Base {formatPaise(product.baseAmountPaise)} + GST {product.gstRatePercent}% ({formatPaise(product.gstAmountPaise)})
              </p>
              {isAnnual && annualSavingsNote ? (
                <p className="mt-1 text-xs font-semibold text-emerald-700">{annualSavingsNote}</p>
              ) : null}
            </div>
            <ul className="grid gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              <li>
                {product.durationMonths
                  ? `${product.durationMonths} calendar month${product.durationMonths > 1 ? 's' : ''} of ATS + resume database access`
                  : 'One job-posting credit'}
              </li>
              <li>
                {product.includedJobCredits > 0
                  ? `${product.includedJobCredits} included job-posting credit${product.includedJobCredits > 1 ? 's' : ''}`
                  : 'No included job-posting credits'}
              </li>
              <li>Each activated job stays live for {product.jobActiveDays} days</li>
              {product.includedJobCredits > 0 ? (
                <li className="text-[var(--color-text-muted)]">
                  Publishing beyond the included credits requires an additional job-posting credit purchase.
                </li>
              ) : null}
            </ul>
            <div className="mt-auto pt-2">{renderAction(product)}</div>
          </Card>
        );
      })}
    </div>
  );
}
