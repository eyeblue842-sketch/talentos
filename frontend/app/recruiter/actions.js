'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionToken, requestBackend } from '@/lib/auth';

function splitCommaList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function recruiterRequest(path, options = {}) {
  const token = await getSessionToken();
  if (!token) {
    throw new Error('Authentication required.');
  }

  return requestBackend(path, options, token);
}

function asNullableString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildJobPayload(formData) {
  return {
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    skillsRequired: splitCommaList(formData.get('skillsRequired')),
    experienceMin: Number(formData.get('experienceMin')),
    experienceMax: Number(formData.get('experienceMax')),
    salaryMin: formData.get('salaryMin') ? Number(formData.get('salaryMin')) : null,
    salaryMax: formData.get('salaryMax') ? Number(formData.get('salaryMax')) : null,
    currency: asNullableString(formData.get('currency')),
    location: String(formData.get('location') || '').trim(),
    employmentType: String(formData.get('employmentType') || 'FULL_TIME'),
    workplaceType: asNullableString(formData.get('workplaceType')),
    numberOfOpenings: Number(formData.get('numberOfOpenings') || 1),
    department: asNullableString(formData.get('department')),
    businessUnit: asNullableString(formData.get('businessUnit')),
    requisitionId: asNullableString(formData.get('requisitionId')),
    hiringManagerId: asNullableString(formData.get('hiringManagerId')),
    recruiterId: asNullableString(formData.get('recruiterId')),
    applicationDeadline: asNullableString(formData.get('applicationDeadline')),
    status: String(formData.get('status') || 'DRAFT'),
  };
}

export async function createJobAction(formData) {
  await recruiterRequest('/jobs', {
    method: 'POST',
    body: JSON.stringify(buildJobPayload(formData)),
  });

  revalidatePath('/recruiter');
  revalidatePath('/recruiter/jobs');
  redirect('/recruiter/jobs?notice=job-created');
}

export async function updateJobAction(jobId, formData) {
  await recruiterRequest(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(buildJobPayload(formData)),
  });

  revalidatePath('/recruiter');
  revalidatePath('/recruiter/jobs');
  revalidatePath(`/recruiter/jobs/${jobId}`);
  redirect(`/recruiter/jobs/${jobId}?notice=job-updated`);
}

export async function updateJobStatusAction(jobId, formData) {
  await recruiterRequest(`/jobs/${jobId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: String(formData.get('status')) }),
  });

  revalidatePath('/recruiter');
  revalidatePath('/recruiter/jobs');
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function deleteJobAction(jobId) {
  await recruiterRequest(`/jobs/${jobId}`, { method: 'DELETE' });
  revalidatePath('/recruiter');
  revalidatePath('/recruiter/jobs');
  redirect('/recruiter/jobs?notice=job-deleted');
}

export async function saveCandidateAction(candidateId, formData) {
  await recruiterRequest(`/resumes/saved/${candidateId}`, {
    method: 'POST',
    body: JSON.stringify({ tag: asNullableString(formData.get('tag')) }),
  });
  revalidatePath('/recruiter/database');
  revalidatePath(`/recruiter/database/${candidateId}`);
}

export async function unsaveCandidateAction(candidateId) {
  await recruiterRequest(`/resumes/saved/${candidateId}`, { method: 'DELETE' });
  revalidatePath('/recruiter/database');
  revalidatePath(`/recruiter/database/${candidateId}`);
}

export async function moveApplicationStageAction(applicationId, formData) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage: String(formData.get('stage')) }),
  });
  revalidatePath('/recruiter');
  revalidatePath('/recruiter/ats');
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function addNoteAction(applicationId, formData) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content: String(formData.get('content') || '') }),
  });
  revalidatePath('/recruiter/ats');
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function editNoteAction(applicationId, noteId, formData) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content: String(formData.get('content') || '') }),
  });
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function deleteNoteAction(applicationId, noteId) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/notes/${noteId}`, { method: 'DELETE' });
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function scheduleInterviewAction(applicationId, formData) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/interview`, {
    method: 'PATCH',
    body: JSON.stringify({
      roundId: String(formData.get('roundId')),
      interviewType: String(formData.get('interviewType')),
      scheduledStartAt: new Date(String(formData.get('scheduledStartAt'))).toISOString(),
      scheduledEndAt: new Date(String(formData.get('scheduledEndAt'))).toISOString(),
      panelUserIds: splitCommaList(formData.get('panelUserIds')),
      meetingLocation: asNullableString(formData.get('meetingLocation')),
      meetingLink: asNullableString(formData.get('meetingLink')),
      status: 'SCHEDULED',
    }),
  });
  revalidatePath('/recruiter');
  revalidatePath('/recruiter/ats');
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function cancelInterviewAction(applicationId, formData) {
  await recruiterRequest(`/ats/pipeline/${applicationId}/interview/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({
      roundId: String(formData.get('roundId')),
      cancelReason: String(formData.get('cancelReason') || ''),
    }),
  });
  revalidatePath('/recruiter');
  revalidatePath('/recruiter/ats');
  revalidatePath(`/recruiter/ats/${applicationId}`);
}

export async function markNotificationReadAction(notificationId) {
  await recruiterRequest('/notifications/read', {
    method: 'POST',
    body: JSON.stringify({ notificationIds: [notificationId] }),
  });
  revalidatePath('/recruiter/notifications');
}
