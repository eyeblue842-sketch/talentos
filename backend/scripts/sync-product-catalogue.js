import { closePrisma } from '../src/config/db.js';
import { ensureProductCatalogueSeeded } from '../src/services/productCatalogueService.js';

// Deliberate, explicit, operator-run sync of the billing ProductPlan
// catalogue (B1 hardening, section 10). NOT run automatically at server
// boot. Run this once per deploy that changes CATALOGUE_DEFINITIONS in
// productCatalogueService.js, after applying any pending Prisma migration:
//
//   npm run catalogue:sync --prefix backend
//
// Idempotent and safe to run multiple times / from multiple instances -
// see ensureProductCatalogueSeeded's own doc comment for exactly what
// "safe" means here (existing commercial terms are immutable; a changed
// price without a version bump throws instead of silently overwriting).
async function main() {
  await ensureProductCatalogueSeeded();
  console.log(JSON.stringify({ level: 'info', event: 'billing.catalogue.synced' }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'billing.catalogue.sync_failed',
      code: error?.code || 'CATALOGUE_SYNC_FAILED',
      message: error?.message || 'Unable to sync the billing product catalogue.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma().catch(() => {});
  });
