import { prisma } from '../src/config/db.js';
import { calculateProfileCompletion } from '../src/services/candidateService.js';
import { buildCandidateProfileRepairData, normalizeCandidateProfileForPresentation } from '../src/services/candidateProfileSanitizer.js';

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: node backend/scripts/repair-candidate-profile.js <candidateId|userId|email>');
    process.exitCode = 1;
    return;
  }

  const profile = await prisma.candidateProfile.findFirst({
    where: {
      OR: [
        { id: identifier },
        { userId: identifier },
        { email: identifier.toLowerCase() },
        { user: { email: identifier.toLowerCase() } },
      ],
    },
    include: {
      user: true,
      latestResumeAsset: true,
    },
  });

  if (!profile) {
    console.error(`Candidate profile not found for "${identifier}".`);
    process.exitCode = 1;
    return;
  }

  const repairData = buildCandidateProfileRepairData(profile);
  if (!Object.keys(repairData).length) {
    console.log(JSON.stringify({
      candidateId: profile.id,
      repaired: false,
      message: 'No polluted candidate profile fields detected.',
    }, null, 2));
    return;
  }

  const merged = normalizeCandidateProfileForPresentation({ ...profile, ...repairData });
  repairData.profileCompletenessScore = calculateProfileCompletion(merged).percentage;

  const updated = await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: repairData,
  });

  console.log(JSON.stringify({
    candidateId: updated.id,
    repaired: true,
    updatedFields: Object.keys(repairData),
    profileCompletenessScore: updated.profileCompletenessScore,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
