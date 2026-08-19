import { prisma } from '../config/db.js';

// Only authenticated candidate actions should update this searchable timestamp.
export async function touchCandidateLastActive(candidateId, at = new Date()) {
  if (!candidateId || typeof prisma.candidateProfile?.update !== 'function') {
    return false;
  }

  try {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { lastActiveAt: at },
    });
    return true;
  } catch (error) {
    // Activity tracking is secondary to the candidate action itself while a
    // deployment is missing the current Prisma table/column, or when the
    // candidate row itself doesn't exist yet (e.g. a fixture/test identity).
    if (['P1001', 'P1002', 'P1008', 'P1017', 'P2021', 'P2022', 'P2025'].includes(error?.code)) {
      return false;
    }
    throw error;
  }
}
