import nodemailer from 'nodemailer';
import dayjs from 'dayjs';
import { env } from '../config/env.js';

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    })
  : null;

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
