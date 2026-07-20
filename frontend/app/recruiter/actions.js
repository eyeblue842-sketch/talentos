'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionToken, ORGANISATION_COOKIE, requestBackend } from '@/lib/auth';

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

async function setActiveOrganisationCookie(organisationId) {
  if (!organisationId) return;
  const cookieStore = await cookies();
  cookieStore.set(ORGANISATION_COOKIE, organisationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
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
    applicationOpensAt: asNullableString(formData.get('applicationOpensAt')),
    applicationClosesAt: asNullableString(formData.get('applicationClosesAt')),
    maxApplications: formData.get('maxApplications') ? Number(formData.get('maxApplications')) : null,
    targetHires: formData.get('targetHires') ? Number(formData.get('targetHires')) : null,
    autoCloseOnTargetHire: formData.get('autoCloseOnTargetHire') === 'on',
    isPublic: formData.get('isPublic') === 'on',
    publicSalaryEnabled: formData.get('publicSalaryEnabled') === 'on',
    featuredInPortal: formData.get('featuredInPortal') === 'on',
    visibility: String(formData.get('visibility') || 'EXTERNAL'),
    status: String(formData.get('status') || 'DRAFT'),
  };
}

function buildQuestionPayload(formData) {
  const questionType = String(formData.get('questionType') || 'SHORT_TEXT');
  const rawOptions = splitCommaList(formData.get('options'));
  return {
    questionText: String(formData.get('questionText') || '').trim(),
    internalLabel: asNullableString(formData.get('internalLabel')),
    helpText: asNullableString(formData.get('helpText')),
    placeholder: asNullableString(formData.get('placeholder')),
    questionType,
    required: formData.get('required') === 'on',
    isActive: formData.get('isActive') !== 'off',
    config: ['SINGLE_SELECT', 'MULTI_SELECT'].includes(questionType)
      ? {
          options: rawOptions.map((item, index) => ({
            id: `option-${index + 1}`,
            label: item,
            value: item,
          })),
        }
      : {},
    validationConfig: {
      minTextLength: formData.get('minTextLength') ? Number(formData.get('minTextLength')) : null,
      maxTextLength: formData.get('maxTextLength') ? Number(formData.get('maxTextLength')) : null,
      minNumber: formData.get('minNumber') ? Number(formData.get('minNumber')) : null,
      maxNumber: formData.get('maxNumber') ? Number(formData.get('maxNumber')) : null,
      allowedCurrency: asNullableString(formData.get('allowedCurrency')),
      allowedFileTypes: splitCommaList(formData.get('allowedFileTypes')),
      maxFileSizeBytes: formData.get('maxFileSizeBytes') ? Number(formData.get('maxFileSizeBytes')) : null,
    },
    rules: formData.get('ruleOperator') && formData.get('ruleOutcome') && formData.get('ruleReason')
      ? [{
          operator: String(formData.get('ruleOperator')),
          value: ['NUMBER', 'CURRENCY'].includes(questionType)
            ? Number(formData.get('ruleValue'))
            : ['MULTI_SELECT', 'SINGLE_SELECT'].includes(questionType)
              ? splitCommaList(formData.get('ruleValue'))
              : String(formData.get('ruleValue') || ''),
          outcome: String(formData.get('ruleOutcome')),
          reason: String(formData.get('ruleReason')),
        }]
      : [],
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

export async function completeRecruiterOnboardingAction(formData) {
  const payload = {
    organisationName: String(formData.get('organisationName') || '').trim(),
    workspaceSlug: String(formData.get('workspaceSlug') || '').trim(),
    companyWebsite: asNullableString(formData.get('companyWebsite')),
    industry: String(formData.get('industry') || '').trim(),
    companySize: String(formData.get('companySize') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    designation: String(formData.get('designation') || '').trim(),
    teamInvitationEmail: asNullableString(formData.get('teamInvitationEmail')),
    teamInvitationRole: asNullableString(formData.get('teamInvitationRole')),
  };

  const response = await recruiterRequest('/organisations/current/onboarding', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (payload.teamInvitationEmail && payload.teamInvitationRole) {
    await recruiterRequest('/organisations/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.teamInvitationEmail,
        role: payload.teamInvitationRole,
      }),
    });
  }

  await setActiveOrganisationCookie(response.data.organisation?.id);
  revalidatePath('/recruiter');
  revalidatePath('/recruiter/onboarding');
  redirect('/recruiter?notice=workspace-ready');
}

export async function inviteOrganisationMemberAction(formData) {
  await recruiterRequest('/organisations/invitations', {
    method: 'POST',
    body: JSON.stringify({
      email: String(formData.get('email') || '').trim(),
      role: String(formData.get('role') || '').trim(),
    }),
  });
  revalidatePath('/recruiter/members');
  redirect('/recruiter/members?notice=invitation-sent');
}

export async function resendOrganisationInvitationAction(invitationId) {
  await recruiterRequest(`/organisations/invitations/${invitationId}/resend`, { method: 'POST' });
  revalidatePath('/recruiter/members');
}

export async function revokeOrganisationInvitationAction(invitationId) {
  await recruiterRequest(`/organisations/invitations/${invitationId}/revoke`, { method: 'POST' });
  revalidatePath('/recruiter/members');
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

export async function createScreeningTemplateAction(formData) {
  await recruiterRequest('/jobs/screening-templates', {
    method: 'POST',
    body: JSON.stringify(buildQuestionPayload(formData)),
  });
  revalidatePath('/recruiter/jobs');
}

export async function addJobQuestionAction(jobId, formData) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions`, {
    method: 'POST',
    body: JSON.stringify(buildQuestionPayload(formData)),
  });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function addJobQuestionFromLibraryAction(jobId, formData) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions/from-library`, {
    method: 'POST',
    body: JSON.stringify({ templateId: String(formData.get('templateId')) }),
  });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function updateJobQuestionAction(jobId, questionId, formData) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(buildQuestionPayload(formData)),
  });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function deleteJobQuestionAction(jobId, questionId) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions/${questionId}`, { method: 'DELETE' });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function duplicateJobQuestionAction(jobId, questionId) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions/${questionId}/duplicate`, { method: 'POST' });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function reorderJobQuestionsAction(jobId, questionIds) {
  await recruiterRequest(`/jobs/${jobId}/screening-questions/reorder`, {
    method: 'POST',
    body: JSON.stringify({ questionIds }),
  });
  revalidatePath(`/recruiter/jobs/${jobId}`);
}
