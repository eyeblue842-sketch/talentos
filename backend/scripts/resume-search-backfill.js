import { prisma } from '../src/config/db.js';
import { enqueueResumeSearchIndexUpsert } from '../src/services/resumeSearchV2/indexingService.js';
import { RESUME_SEARCH_INDEX_SCHEMA_VERSION } from '../src/services/resumeSearchV2/mapping.js';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    execute: false,
    testMode: false,
    orgIds: [],
    batchSize: 100,
    cursor: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--execute') args.execute = true;
    else if (value === '--test-mode') args.testMode = true;
    else if (value === '--org') args.orgIds.push(argv[index + 1]), index += 1;
    else if (value === '--batch-size') args.batchSize = Number(argv[index + 1] || 100), index += 1;
    else if (value === '--cursor') args.cursor = argv[index + 1] || null, index += 1;
  }

  return args;
}

async function main() {
  const options = parseArgs();
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error('batch-size must be an integer between 1 and 500.');
  }

  if (options.execute && !options.testMode) {
    throw new Error('Refusing non-test execution. Use dry-run default or add --test-mode in isolated environments only.');
  }

  const where = {
    searchableProfile: true,
    ...(options.orgIds.length ? { organisationId: { in: options.orgIds } } : {}),
    ...(options.cursor ? { id: { gt: options.cursor } } : {}),
  };
  const candidates = await prisma.candidateProfile.findMany({
    where,
    orderBy: { id: 'asc' },
    take: options.batchSize,
    select: {
      id: true,
      organisationId: true,
      importBatchId: true,
      updatedAt: true,
    },
  });

  const nextCursor = candidates.length ? candidates[candidates.length - 1].id : null;
  const payload = {
    mode: options.execute ? 'EXECUTE' : 'DRY_RUN',
    testMode: options.testMode,
    indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
    candidateCount: candidates.length,
    nextCursor,
    candidateIds: candidates.map((candidate) => candidate.id),
  };

  if (!options.execute) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  for (const candidate of candidates) {
    await enqueueResumeSearchIndexUpsert(candidate.id, {
      correlationId: `backfill:${candidate.id}`,
    });
  }

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
