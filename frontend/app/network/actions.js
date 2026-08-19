'use server';

import { revalidatePath } from 'next/cache';
import {
  acceptNetworkRequest,
  blockNetworkUser,
  declineNetworkRequest,
  followCompany,
  removeNetworkConnection,
  sendNetworkRequest,
  unfollowCompany,
  unblockNetworkUser,
  updateNetworkPrivacy,
  withdrawNetworkRequest,
} from '@/lib/api';

function revalidateNetworkPath(path) {
  if (!path) return;
  revalidatePath(path);
}

function commonRevalidate(path) {
  revalidateNetworkPath(path);
  revalidatePath('/candidate/network');
  revalidatePath('/recruiter/network');
}

export async function sendConnectionRequestAction(formData) {
  const targetUserId = String(formData.get('targetUserId') || '');
  const source = String(formData.get('source') || 'PROFILE');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!targetUserId) return;
  await sendNetworkRequest({ targetUserId, source });
  commonRevalidate(redirectTo);
}

export async function acceptConnectionRequestAction(formData) {
  const requestId = String(formData.get('requestId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!requestId) return;
  await acceptNetworkRequest(requestId);
  commonRevalidate(redirectTo);
}

export async function declineConnectionRequestAction(formData) {
  const requestId = String(formData.get('requestId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!requestId) return;
  await declineNetworkRequest(requestId);
  commonRevalidate(redirectTo);
}

export async function withdrawConnectionRequestAction(formData) {
  const requestId = String(formData.get('requestId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!requestId) return;
  await withdrawNetworkRequest(requestId);
  commonRevalidate(redirectTo);
}

export async function removeConnectionAction(formData) {
  const connectionId = String(formData.get('connectionId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!connectionId) return;
  await removeNetworkConnection(connectionId);
  commonRevalidate(redirectTo);
}

export async function blockUserAction(formData) {
  const userId = String(formData.get('userId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!userId) return;
  await blockNetworkUser(userId);
  commonRevalidate(redirectTo);
}

export async function unblockUserAction(formData) {
  const userId = String(formData.get('userId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/network');
  if (!userId) return;
  await unblockNetworkUser(userId);
  commonRevalidate(redirectTo);
}

export async function followCompanyAction(formData) {
  const organisationId = String(formData.get('organisationId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/companies');
  if (!organisationId) return;
  await followCompany(organisationId);
  commonRevalidate(redirectTo);
}

export async function unfollowCompanyAction(formData) {
  const organisationId = String(formData.get('organisationId') || '');
  const redirectTo = String(formData.get('redirectTo') || '/companies');
  if (!organisationId) return;
  await unfollowCompany(organisationId);
  commonRevalidate(redirectTo);
}

export async function updateNetworkPrivacyAction(previousState, formData) {
  try {
    await updateNetworkPrivacy({
      allowConnectionRequestsFrom: String(formData.get('allowConnectionRequestsFrom') || 'EVERYONE'),
      connectionVisibility: String(formData.get('connectionVisibility') || 'CONNECTIONS_ONLY'),
      showInPeopleSearch: formData.get('showInPeopleSearch') === 'on',
      showRecruiterIdentity: formData.get('showRecruiterIdentity') === 'on',
    });
    commonRevalidate('/candidate/network');
    commonRevalidate('/recruiter/network');
    return {
      status: 'success',
      message: 'Network privacy updated.',
      fieldErrors: {},
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'Unable to update privacy settings.',
      fieldErrors: error.details?.fieldErrors || {},
    };
  }
}
