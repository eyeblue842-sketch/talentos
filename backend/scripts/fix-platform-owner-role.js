import 'dotenv/config';
import { prisma } from '../src/config/db.js';

/**
 * One-time repair: restore the platform owner's ORGANISATION role.
 *
 * Platform console access is email-based (see middleware/platformAdmin.js), so
 * the owner does NOT need the PLATFORM_ADMIN UserRole - and holding it would
 * strip their recruiter/org-admin access (recruiter routes don't accept
 * PLATFORM_ADMIN). If an earlier role-based bootstrap left the configured owner
 * as PLATFORM_ADMIN, this resets them to RECRUITER_ADMIN so their own
 * organisation workspace works again. It only ever touches the single
 * configured email, only when that account is currently PLATFORM_ADMIN, and is
 * safe to rerun.
 *
 * Usage:
 *   PLATFORM_SUPER_ADMIN_EMAIL='vinoj@xportisglobal.com' npm run fix:platform-owner-role
 */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function main() {
  const configured = normalizeEmail(process.env.PLATFORM_SUPER_ADMIN_EMAIL);
  if (!configured) {
    console.error('Missing PLATFORM_SUPER_ADMIN_EMAIL.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: configured, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.warn(`No account found for ${configured}; nothing to do.`);
    return;
  }

  if (user.role !== 'PLATFORM_ADMIN') {
    console.log(JSON.stringify({ email: user.email, role: user.role, changed: false, message: 'Already a non-platform role; no change.' }, null, 2));
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'RECRUITER_ADMIN' },
    select: { email: true, role: true },
  });
  console.log(JSON.stringify({ email: updated.email, role: updated.role, changed: true, message: 'Restored recruiter/org-admin role. Platform access remains via email.' }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
