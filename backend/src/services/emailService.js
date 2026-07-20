import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { env } from '../config/env.js';

const sentEmails = [];

function createSmtpTransport() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
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

async function sendTransactionalEmail({ to, subject, text }) {
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

export async function sendRecruiterOutreachEmail(to, subject, text) {
  await sendTransactionalEmail({ to, subject, text });
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

export async function sendPasswordResetEmail(to, token) {
  const resetUrl = new URL('/api/auth/password-reset/start', env.frontendUrl);
  resetUrl.searchParams.set('token', token);

  await sendTransactionalEmail({
    to,
    subject: 'Reset your Careeriz password',
    text: `Use this link to reset your password: ${resetUrl.toString()}`,
  });
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
