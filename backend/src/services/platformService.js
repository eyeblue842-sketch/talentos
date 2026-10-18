import { prisma } from '../config/db.js';

// ---------------------------------------------------------------------------
// Platform operator console service (feature/platform-super-admin).
//
// Cross-organisation, read-oriented data for the single global super admin.
// Every caller of these functions MUST already have passed
// requirePlatformSuperAdmin() at the route layer - these functions deliberately
// do NOT scope to an organisation (that is the whole point of the console), so
// they must never be reachable by an org-scoped admin.
// ---------------------------------------------------------------------------

// Subscription statuses that mean the org is currently on a paid plan.
const ACTIVE_SUB_STATUSES = ['ACTIVE', 'EXPIRING_SOON'];

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}
function rupees(paise) {
  return typeof paise === 'number' ? Math.round(paise) / 100 : 0;
}
function notFound(message = 'Organisation not found.') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function isSubActive(sub, now = new Date()) {
  return Boolean(sub && ACTIVE_SUB_STATUSES.includes(sub.status) && new Date(sub.expiresAt) > now);
}

function groupMap(groups, key = 'status') {
  const out = {};
  for (const g of groups || []) {
    out[g[key]] = g._count?._all ?? g._count ?? 0;
  }
  return out;
}

export async function getPlatformOverview() {
  const now = new Date();
  const [
    totalOrganisations,
    orgStatusGroups,
    totalUsers,
    userRoleGroups,
    purchaseStatusGroups,
    subscriptionStatusGroups,
    paidOrgRows,
    paidAgg,
    refundAgg,
    manualReviewCount,
    recentOrganisations,
    recentPurchases,
    flaggedPurchases,
  ] = await Promise.all([
    prisma.organisation.count(),
    prisma.organisation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.purchase.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountPaise: true } }),
    prisma.companySubscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.companySubscription.findMany({
      where: { status: { in: ACTIVE_SUB_STATUSES }, expiresAt: { gt: now } },
      select: { organisationId: true },
      distinct: ['organisationId'],
    }),
    prisma.purchase.aggregate({ _sum: { amountPaise: true }, where: { status: 'PAID' } }),
    prisma.purchase.aggregate({ _sum: { amountPaise: true }, where: { status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } } }),
    prisma.purchase.count({ where: { requiresManualReview: true } }),
    prisma.organisation.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, name: true, slug: true, type: true, status: true, createdAt: true } }),
    prisma.purchase.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { organisation: { select: { id: true, name: true } } } }),
    prisma.purchase.findMany({ where: { requiresManualReview: true }, orderBy: { createdAt: 'desc' }, take: 10, include: { organisation: { select: { id: true, name: true } } } }),
  ]);

  const purchaseCounts = groupMap(purchaseStatusGroups);
  const paidOrganisations = paidOrgRows.length;

  return {
    organisations: {
      total: totalOrganisations,
      paid: paidOrganisations,
      free: Math.max(totalOrganisations - paidOrganisations, 0),
      byStatus: groupMap(orgStatusGroups),
    },
    subscriptions: {
      byStatus: groupMap(subscriptionStatusGroups),
      activeNow: paidOrganisations,
    },
    users: {
      total: totalUsers,
      byRole: groupMap(userRoleGroups, 'role'),
    },
    payments: {
      successful: purchaseCounts.PAID || 0,
      failed: purchaseCounts.FAILED || 0,
      pending: purchaseCounts.PENDING || 0,
      refunded: (purchaseCounts.REFUNDED || 0) + (purchaseCounts.PARTIALLY_REFUNDED || 0),
      cancelled: purchaseCounts.CANCELLED || 0,
      needsManualReview: manualReviewCount,
    },
    revenue: {
      currency: 'INR',
      collected: rupees(paidAgg._sum.amountPaise || 0),
      refunded: rupees(refundAgg._sum.amountPaise || 0),
      net: rupees((paidAgg._sum.amountPaise || 0) - (refundAgg._sum.amountPaise || 0)),
      // The Careeriz catalogue is term-based prepaid (45-day / 1-6-12 month)
      // rather than auto-renewing monthly, so a classic MRR is not meaningful.
      mrr: null,
      mrrNote: 'Term-based prepaid plans - MRR is not applicable.',
    },
    recentOrganisations: recentOrganisations.map((org) => ({
      id: org.id, name: org.name, slug: org.slug, type: org.type, status: org.status, createdAt: iso(org.createdAt),
    })),
    recentPayments: recentPurchases.map(serializePurchaseRow),
    needsIntervention: flaggedPurchases.map(serializePurchaseRow),
  };
}

function serializePurchaseRow(purchase) {
  return {
    id: purchase.id,
    organisationId: purchase.organisationId,
    organisationName: purchase.organisation?.name || null,
    productCode: purchase.productCode,
    status: purchase.status,
    amount: rupees(purchase.amountPaise),
    currency: purchase.currency,
    provider: purchase.provider,
    providerOrderId: purchase.providerOrderId || null,
    providerPaymentId: purchase.providerPaymentId || null,
    requiresManualReview: purchase.requiresManualReview,
    manualReviewReason: purchase.manualReviewReason || null,
    failureReason: purchase.failureReason || null,
    paidAt: iso(purchase.paidAt),
    failedAt: iso(purchase.failedAt),
    refundedAt: iso(purchase.refundedAt),
    createdAt: iso(purchase.createdAt),
  };
}

function serializeSubscriptionRow(sub, now = new Date()) {
  return {
    id: sub.id,
    organisationId: sub.organisationId,
    purchaseId: sub.purchaseId,
    productCode: sub.productCode,
    status: sub.status,
    isActive: isSubActive(sub, now),
    atsAccess: sub.atsAccess,
    resumeDatabaseAccess: sub.resumeDatabaseAccess,
    includedJobCredits: sub.includedJobCredits,
    startsAt: iso(sub.startsAt),
    expiresAt: iso(sub.expiresAt),
    suspendedAt: iso(sub.suspendedAt),
    cancelledAt: iso(sub.cancelledAt),
    createdAt: iso(sub.createdAt),
  };
}

function currentSubscription(list, now = new Date()) {
  if (!list?.length) return null;
  return list.find((sub) => isSubActive(sub, now)) || list[0];
}

export async function listOrganisations(filters = {}) {
  const now = new Date();
  const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const where = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: String(filters.search), mode: 'insensitive' } },
      { slug: { contains: String(filters.search), mode: 'insensitive' } },
    ];
  }
  if (filters.status) where.status = filters.status;

  const [total, orgs] = await Promise.all([
    prisma.organisation.count({ where }),
    prisma.organisation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        _count: { select: { memberships: true } },
        memberships: {
          where: { role: 'OWNER' },
          take: 1,
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    }),
  ]);

  const orgIds = orgs.map((o) => o.id);
  const [subs, purchases] = orgIds.length
    ? await Promise.all([
      prisma.companySubscription.findMany({ where: { organisationId: { in: orgIds } }, orderBy: { createdAt: 'desc' } }),
      prisma.purchase.findMany({ where: { organisationId: { in: orgIds } }, orderBy: { createdAt: 'desc' } }),
    ])
    : [[], []];

  const subsByOrg = new Map();
  for (const sub of subs) {
    if (!subsByOrg.has(sub.organisationId)) subsByOrg.set(sub.organisationId, []);
    subsByOrg.get(sub.organisationId).push(sub);
  }
  const latestPurchaseByOrg = new Map();
  for (const purchase of purchases) {
    if (!latestPurchaseByOrg.has(purchase.organisationId)) latestPurchaseByOrg.set(purchase.organisationId, purchase);
  }

  const items = orgs.map((org) => {
    const sub = currentSubscription(subsByOrg.get(org.id), now);
    const ownerMembership = org.memberships?.[0];
    const latestPurchase = latestPurchaseByOrg.get(org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      status: org.status,
      createdAt: iso(org.createdAt),
      memberCount: org._count?.memberships ?? 0,
      owner: ownerMembership?.user
        ? { id: ownerMembership.user.id, email: ownerMembership.user.email, name: ownerMembership.user.name }
        : null,
      plan: isSubActive(sub, now) ? 'PAID' : 'FREE',
      subscription: sub ? { status: sub.status, productCode: sub.productCode, isActive: isSubActive(sub, now), expiresAt: iso(sub.expiresAt) } : null,
      latestPayment: latestPurchase
        ? { status: latestPurchase.status, amount: rupees(latestPurchase.amountPaise), requiresManualReview: latestPurchase.requiresManualReview, createdAt: iso(latestPurchase.createdAt) }
        : null,
    };
  });

  return { items, meta: { total, limit, offset } };
}

export async function getOrganisationDetail(organisationId) {
  const now = new Date();
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    include: {
      settings: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, accountStatus: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true } } },
      },
    },
  });
  if (!org) throw notFound();

  const [subscriptions, purchases, auditLogs] = await Promise.all([
    prisma.companySubscription.findMany({ where: { organisationId }, orderBy: { createdAt: 'desc' } }),
    prisma.purchase.findMany({ where: { organisationId }, orderBy: { createdAt: 'desc' }, include: { invoice: { select: { id: true, invoiceNumber: true, totalPayablePaise: true, invoiceDate: true } } } }),
    prisma.auditLog.findMany({ where: { organisationId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []),
  ]);

  const current = currentSubscription(subscriptions, now);

  return {
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      status: org.status,
      website: org.website,
      industry: org.industry,
      organisationSize: org.organisationSize,
      headquarters: org.headquarters,
      verifiedDomain: org.verifiedDomain,
      domainVerificationStatus: org.domainVerificationStatus,
      createdAt: iso(org.createdAt),
      onboardingCompletedAt: iso(org.onboardingCompletedAt),
    },
    plan: isSubActive(current, now) ? 'PAID' : 'FREE',
    currentSubscription: current ? serializeSubscriptionRow(current, now) : null,
    members: org.memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      status: m.status,
      user: m.user
        ? {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          platformRole: m.user.role,
          isActive: m.user.isActive,
          accountStatus: m.user.accountStatus,
          emailVerified: Boolean(m.user.emailVerifiedAt),
          lastLoginAt: iso(m.user.lastLoginAt),
          createdAt: iso(m.user.createdAt),
        }
        : null,
    })),
    subscriptions: subscriptions.map((s) => serializeSubscriptionRow(s, now)),
    payments: purchases.map((p) => ({
      ...serializePurchaseRow({ ...p, organisation: { id: org.id, name: org.name } }),
      invoice: p.invoice ? { id: p.invoice.id, invoiceNumber: p.invoice.invoiceNumber, total: rupees(p.invoice.totalPayablePaise), issuedAt: iso(p.invoice.invoiceDate) } : null,
    })),
    auditLogs: (auditLogs || []).map((log) => ({
      id: log.id,
      action: log.action || log.eventType || null,
      actorUserId: log.actorUserId || null,
      metadata: log.metadata || null,
      createdAt: iso(log.createdAt),
    })),
  };
}
