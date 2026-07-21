'use server';

import { revalidatePath } from 'next/cache';
import { requestBackend } from '@/lib/auth';

export async function acceptPublicOfferAction(formData) {
  const token = String(formData.get('token') || '');
  await requestBackend(`/offers/access/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      confirmation: true,
      comment: String(formData.get('comment') || '') || null,
    }),
  });
  revalidatePath(`/offers/access/${token}`);
}

export async function rejectPublicOfferAction(formData) {
  const token = String(formData.get('token') || '');
  await requestBackend(`/offers/access/${token}/reject`, {
    method: 'POST',
    body: JSON.stringify({
      reason: String(formData.get('reason') || '').trim(),
      comment: String(formData.get('comment') || '') || null,
    }),
  });
  revalidatePath(`/offers/access/${token}`);
}

export async function requestPublicOfferRevisionAction(formData) {
  const token = String(formData.get('token') || '');
  await requestBackend(`/offers/access/${token}/revision-request`, {
    method: 'POST',
    body: JSON.stringify({
      comment: String(formData.get('comment') || '').trim(),
    }),
  });
  revalidatePath(`/offers/access/${token}`);
}
