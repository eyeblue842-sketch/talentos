'use server';

import { revalidatePath } from 'next/cache';
import {
  suspendPlatformSubscription,
  reactivatePlatformSubscription,
  adjustPlatformCredits,
  resendPlatformRenewalReminder,
  reconcilePlatformPurchase,
  reviewPlatformRefund,
  grantPlatformComplimentary,
  invitePlatformUser,
  changePlatformUserEmail,
  setPlatformUserActive,
} from '@/lib/api';

// Server actions for the platform console's Phase 3 billing operations. Each one
// is a thin wrapper that calls the super-admin-gated backend endpoint (the real
// authorization + audit happen server-side) and revalidates the organisation
// detail page so the console re-renders from fresh data. Errors are returned as
// serializable `{ ok:false, error }` so the client can toast them.
function revalidateOrg(organisationId) {
  revalidatePath(`/platform/organisations/${organisationId}`);
  revalidatePath('/platform/organisations');
  revalidatePath('/platform');
}

export async function suspendSubscriptionAction(organisationId, reason) {
  try {
    await suspendPlatformSubscription(organisationId, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function reactivateSubscriptionAction(organisationId, reason) {
  try {
    await reactivatePlatformSubscription(organisationId, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function adjustCreditsAction(organisationId, amount, reason) {
  try {
    await adjustPlatformCredits(organisationId, amount, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function resendRenewalReminderAction(organisationId) {
  try {
    await resendPlatformRenewalReminder(organisationId);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function reconcilePurchaseAction(organisationId, purchaseId, providerReference, reason) {
  try {
    await reconcilePlatformPurchase(purchaseId, providerReference, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function reviewRefundAction(organisationId, purchaseId, approve, reason) {
  try {
    await reviewPlatformRefund(purchaseId, approve, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function grantComplimentaryAction(organisationId, productCode, reason) {
  try {
    await grantPlatformComplimentary(organisationId, productCode, reason);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function inviteUserAction(organisationId, email, role) {
  try {
    await invitePlatformUser(organisationId, email, role);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function changeUserEmailAction(organisationId, userId, email, reason) {
  try {
    await changePlatformUserEmail(userId, email, reason, organisationId);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function setUserActiveAction(organisationId, userId, active, reason) {
  try {
    await setPlatformUserActive(userId, active, reason, organisationId);
    revalidateOrg(organisationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
