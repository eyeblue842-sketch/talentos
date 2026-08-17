import { resumeSearchAdapter } from '../src/services/resumeSearchV2/openSearchAdapter.js';

function parseArgs(argv = process.argv.slice(2)) {
  return {
    execute: argv.includes('--execute'),
    testMode: argv.includes('--test-mode'),
    confirmAliasSwitch: argv.includes('--confirm-alias-switch'),
  };
}

async function main() {
  const options = parseArgs();
  if (options.execute && (!options.testMode || !options.confirmAliasSwitch)) {
    throw new Error('Refusing alias switch without --test-mode and --confirm-alias-switch.');
  }

  const before = await resumeSearchAdapter.getIndexHealth();
  const ensured = await resumeSearchAdapter.ensureIndexVersion();
  const validated = await resumeSearchAdapter.validateAliases({ indexName: ensured.indexName });
  if (options.execute) {
    await resumeSearchAdapter.switchAliases({ indexName: ensured.indexName });
  }
  const after = await resumeSearchAdapter.getIndexHealth();

  console.log(JSON.stringify({
    mode: options.execute ? 'EXECUTE' : 'VALIDATE_ONLY',
    before,
    ensured,
    validated,
    after,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
