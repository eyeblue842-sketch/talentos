import fs from 'fs';
import { prisma } from '../src/config/db.js';
import { classifyLegacyResumeUrl, resolveLegacyResumePath } from '../src/services/legacyResumeService.js';

export async function backfillLegacyResumeAssets({ dryRun = true, logger = console } = {}) {
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      resumeUrl: { not: null },
    },
    select: {
      id: true,
      userId: true,
      latestResumeAssetId: true,
      resumeUrl: true,
    },
  });

  const summary = {
    scanned: candidates.length,
    skippedAlreadyMigrated: 0,
    migrated: 0,
    missingFiles: 0,
    invalidSources: 0,
  };

  for (const candidate of candidates) {
    if (candidate.latestResumeAssetId) {
      summary.skippedAlreadyMigrated += 1;
      continue;
    }

    const classification = classifyLegacyResumeUrl(candidate.resumeUrl);
    if (classification.kind !== 'legacy-local') {
      summary.invalidSources += 1;
      continue;
    }

    let resolved;
    try {
      resolved = resolveLegacyResumePath(candidate.resumeUrl);
    } catch {
      summary.missingFiles += 1;
      continue;
    }

    if (dryRun) {
      summary.migrated += 1;
      continue;
    }

    const existing = await prisma.resumeAsset.findFirst({
      where: {
        candidateId: candidate.id,
        storageKey: resolved.relativePath,
      },
    });

    const asset = existing || await prisma.resumeAsset.create({
      data: {
        candidateId: candidate.id,
        ownerUserId: candidate.userId,
        kind: 'RESUME',
        storageKey: resolved.relativePath,
        storageProvider: 'local',
        originalFilename: resolved.filename,
        mimeType: 'application/octet-stream',
        sizeBytes: fs.statSync(resolved.resolvedPath).size,
      },
    });

    await prisma.candidateProfile.update({
      where: { id: candidate.id },
      data: {
        latestResumeAssetId: asset.id,
      },
    });

    summary.migrated += 1;
  }

  logger.log(summary);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const dryRun = !process.argv.includes('--apply');
  await backfillLegacyResumeAssets({ dryRun });
  await prisma.$disconnect();
}
