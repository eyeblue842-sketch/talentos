import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { enqueueBackgroundTask } from './backgroundTaskService.js';

const sentEmails = [];

// Exported (with an overridable config) so a test can point a real transport
// at a local SMTP listener without needing the app's own test-mode gate
// (env.isTest, always true under this project's `node --test` runner) to be
// bypassed - see password-reset-smtp-acceptance.test.js.
export function createSmtpTransport(config = {}) {
  const host = config.host ?? env.smtpHost;
  const port = config.port ?? env.smtpPort;
  const user = config.user ?? env.smtpUser;
  const pass = config.pass ?? env.smtpPass;

  return nodemailer.createTransport({
    host,
    port,
    auth: user ? { user, pass } : undefined,
  });
}

function createTestTransport() {
  return {
    async sendMail(message) {
      sentEmails.push({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });

      return {
        accepted: [message.to],
        rejected: [],
        envelope: { from: message.from, to: [message.to] },
        messageId: `test-${sentEmails.length}`,
      };
    },
  };
}

export function __resolveEmailTransportInfo(config = {}) {
  const inferredTestMode = process.env.NODE_ENV === 'test'
    || process.argv.some((arg) => arg.includes('node:test') || arg === '--test')
    || process.execArgv.includes('--test');
  const isTest = config.isTest ?? (env.isTest || inferredTestMode);
  const smtpHost = config.smtpHost ?? env.smtpHost;
  const smtpPort = config.smtpPort ?? env.smtpPort;

  return {
    kind: isTest ? 'test' : smtpHost ? 'smtp' : 'stub',
    usesSmtp: !isTest && Boolean(smtpHost),
    host: !isTest && smtpHost ? smtpHost : null,
    port: !isTest && smtpHost ? smtpPort : null,
  };
}

function createTransport() {
  const transportInfo = __resolveEmailTransportInfo();

  if (transportInfo.kind === 'test') {
    return createTestTransport();
  }

  if (transportInfo.kind === 'smtp') {
    return createSmtpTransport();
  }

  return null;
}

const transporter = createTransport();

function emailTemplate(stage, jobTitle, metadata = {}) {
  const templates = {
    INTERVIEW_SCHEDULED: {
      subject: `Interview invite for ${jobTitle}`,
      text: `Your interview is scheduled on ${dayjs(metadata.interviewScheduledAt).format('DD MMM YYYY, hh:mm A')} with ${metadata.interviewerName}.`,
    },
    REJECTED: {
      subject: `Update on your application for ${jobTitle}`,
      text: `Thank you for applying. We are moving ahead with other candidates for ${jobTitle}.`,
    },
    SELECTED: {
      subject: `Offer update for ${jobTitle}`,
      text: `Congratulations. You have been selected for ${jobTitle}. Our team will contact you shortly.`,
    },
    SHORTLISTED: {
      subject: `You have been shortlisted for ${jobTitle}`,
      text: `Your application has progressed to the shortlist stage.`,
    },
  };

  return templates[stage] || {
    subject: `Application update for ${jobTitle}`,
    text: `Your application status changed to ${stage}.`,
  };
}

export async function sendPipelineEmail(to, stage, jobTitle, metadata = {}) {
  const template = emailTemplate(stage, jobTitle, metadata);

  if (!transporter) {
    console.log(`Email stub -> ${to}: ${template.subject}`);
    return;
  }

  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject: template.subject,
    text: template.text,
  });
}

async function deliverEmail({ to, subject, text }) {
  if (!transporter) {
    if (env.isProduction) {
      const error = new Error('Email delivery is not configured.');
      error.statusCode = 503;
      throw error;
    }

    console.log(`Email stub -> ${to}: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
  });
}

async function queueEmailRetry({ to, subject, text }) {
  return enqueueBackgroundTask({
    type: 'EMAIL_RETRY',
    entityType: 'Email',
    entityId: to,
    idempotencyKey: `email-retry:${to}:${subject}:${Buffer.from(text).toString('base64').slice(0, 32)}`,
    payload: {
      message: { to, subject, text },
    },
    nextAttemptAt: new Date(),
    maxAttempts: 5,
  });
}

async function sendTransactionalEmail({ to, subject, text }, { queueOnFailure = true } = {}) {
  try {
    await deliverEmail({ to, subject, text });
  } catch (error) {
    if (queueOnFailure) {
      await queueEmailRetry({ to, subject, text }).catch(() => {});
    }
    throw error;
  }
}

export async function sendRecruiterOutreachEmail(to, subject, text, options = {}) {
  await sendTransactionalEmail({ to, subject, text }, options);
}

export async function sendRecruiterApplicationNotificationEmail({
  to,
  recruiterName,
  candidateName,
  jobTitle,
  appliedAt,
  applicationUrl,
}, options = {}) {
  const safeCandidateName = String(candidateName || 'A candidate').trim() || 'A candidate';
  const safeJobTitle = String(jobTitle || 'your job').trim() || 'your job';
  const safeRecruiterName = String(recruiterName || 'Recruiter').trim() || 'Recruiter';
  const subject = `New application: ${safeJobTitle} - ${safeCandidateName}`;
  const appliedLabel = appliedAt ? dayjs(appliedAt).format('DD MMM YYYY, hh:mm A') : 'just now';
  const text = [
    `Hello ${safeRecruiterName},`,
    '',
    `A new candidate has applied for ${safeJobTitle}.`,
    '',
    `Candidate: ${safeCandidateName}`,
    `Applied: ${appliedLabel}`,
    '',
    `View application: ${applicationUrl}`,
  ].join('\n');

  await sendTransactionalEmail({ to, subject, text }, options);
}

export async function sendQueuedEmailPayload(message) {
  await sendTransactionalEmail(message, { queueOnFailure: false });
}

export function __getSentEmails() {
  return sentEmails.slice();
}

export function __resetSentEmails() {
  sentEmails.length = 0;
}

export function __getEmailTransportInfo() {
  return __resolveEmailTransportInfo();
}

// Pure message builders (exported) so both the real send path and a
// standalone real-SMTP-acceptance test can construct the exact same
// subject/body without going through the app's transport-selection gate.
export function buildPasswordResetEmailMessage(to, token) {
  const resetUrl = new URL('/api/auth/password-reset/start', env.frontendUrl);
  resetUrl.searchParams.set('token', token);

  return {
    to,
    subject: 'Reset your Careeriz password',
    text: `Use this link to reset your password: ${resetUrl.toString()}`,
  };
}

export function buildPasswordResetOtpEmailMessage(to, code) {
  return {
    to,
    subject: 'Your Careeriz password reset verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
  };
}

export async function sendPasswordResetEmail(to, token) {
  await sendTransactionalEmail(buildPasswordResetEmailMessage(to, token));
}

export async function sendPasswordResetOtpEmail(to, code) {
  await sendTransactionalEmail(buildPasswordResetOtpEmailMessage(to, code));
}

export async function sendEmailVerificationEmail(to, token) {
  const verifyUrl = new URL('/api/auth/email-verification/confirm', env.frontendUrl);
  verifyUrl.searchParams.set('token', token);

  await sendTransactionalEmail({
    to,
    subject: 'Verify your Careeriz email',
    text: `Verify your email by visiting: ${verifyUrl.toString()}`,
  });
}

export async function sendOrganisationInvitationEmail({ to, organisationName, role, invitationUrl, expiresAt }) {
  await sendTransactionalEmail({
    to,
    subject: `Join ${organisationName} on Careeriz Hire`,
    text: `You were invited to join ${organisationName} on Careeriz Hire as ${role}. Use this link before ${dayjs(expiresAt).format('DD MMM YYYY, hh:mm A')}: ${invitationUrl}`,
  });
}

export async function sendOfferReleasedEmail({ to, candidateName, jobTitle, organisationName, offerUrl, expiryAt }) {
  await sendTransactionalEmail({
    to,
    subject: `Your offer from ${organisationName} is ready`,
    text: `Hello ${candidateName}, your offer for ${jobTitle} is ready to review. Access it here before ${dayjs(expiryAt).format('DD MMM YYYY, hh:mm A')}: ${offerUrl}`,
  });
}

export async function sendOfferStatusEmail(to, subject, text, options = {}) {
  await sendTransactionalEmail({ to, subject, text }, options);
}

export async function sendPaymentReceiptEmail({ to, productName, amountPaise, invoiceNumber }, options = {}) {
  const amountRupees = (amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const subject = `Payment received: ${productName}`;
  const text = [
    `Your payment of Rs. ${amountRupees} for ${productName} was successful.`,
    invoiceNumber ? `Invoice: ${invoiceNumber}` : null,
    '',
    'View your billing dashboard for full details.',
  ].filter(Boolean).join('\n');

  await sendTransactionalEmail({ to, subject, text }, options);
}

export async function sendSubscriptionRenewalReminderEmail({ to, organisationName, productName, expiresAt, daysRemaining }, options = {}) {
  const subject = `${organisationName}: your Careeriz plan expires in ${daysRemaining} days`;
  const text = [
    `Your ${productName} subscription for ${organisationName} expires on ${dayjs(expiresAt).format('DD MMM YYYY')}.`,
    'Renew before it lapses to keep ATS and resume-database access, and to keep any remaining job-posting credits usable.',
  ].join('\n');

  await sendTransactionalEmail({ to, subject, text }, options);
}

export async function sendJobAutoClosedEmail({ to, jobTitle, activeUntil }, options = {}) {
  const subject = `Job posting closed: ${jobTitle}`;
  const text = `${jobTitle} has automatically closed after its 45-day active window ended on ${dayjs(activeUntil).format('DD MMM YYYY')}. Purchase another job-posting credit to republish it.`;

  await sendTransactionalEmail({ to, subject, text }, options);
}
