import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { SMTPServer } from 'smtp-server';

// Root cause of the "Invitation missing" defect: nodemailer's default
// quoted-printable transfer encoding soft-wraps long plaintext lines at
// ~76 chars (RFC 2045). The invitation URL sits right past that boundary,
// so QP could split the line inside the `?token=` query string - an
// auto-linkifying email client that doesn't rejoin the soft-wrap before
// scanning for a URL only captures the link up to the break, silently
// dropping the token. deliverEmail() now forces base64
// (TRANSACTIONAL_EMAIL_ENCODING) instead, which has no line-break-vs-
// content ambiguity. This test proves that fix survives a real SMTP
// handshake, not just an in-memory mock - mirrors
// password-reset-smtp-acceptance.test.js's harness for the same reason
// (this repo's test-mode transport-selection always picks the fake
// in-memory transport, so the message has to be handed to the same
// createSmtpTransport() the app uses in production, pointed at a real
// local SMTP listener).
//
// No real invitation token is ever used here - only a throwaway
// crypto.randomBytes value scoped to this test process, never logged.

let createSmtpTransport;
let buildOrganisationInvitationEmailMessage;
let buildInvitationAcceptUrl;
let TRANSACTIONAL_EMAIL_ENCODING;

let smtpServer;
let smtpPort;
const receivedMessages = [];

function decodeBase64Body(raw) {
  const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
  return Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8');
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.JWT_SECRET = '12345678901234567890123456789012';

  ({ createSmtpTransport, buildOrganisationInvitationEmailMessage, TRANSACTIONAL_EMAIL_ENCODING } =
    await import('../services/emailService.js'));
  ({ buildInvitationAcceptUrl } = await import('@careeriz/shared'));

  smtpServer = new SMTPServer({
    disabledCommands: ['AUTH', 'STARTTLS'],
    onData(stream, session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        receivedMessages.push({
          from: session.envelope.mailFrom?.address,
          to: session.envelope.rcptTo.map((entry) => entry.address),
          raw: Buffer.concat(chunks).toString('utf8'),
        });
        callback();
      });
    },
  });

  await new Promise((resolve, reject) => {
    smtpServer.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  smtpPort = smtpServer.server.address().port;
});

after(async () => {
  await new Promise((resolve) => smtpServer.close(resolve));
});

test('the invitation email is delivered over real SMTP with the token fully intact and unbroken', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const invitationUrl = buildInvitationAcceptUrl('http://localhost:3000', rawToken).toString();

  const message = buildOrganisationInvitationEmailMessage({
    to: 'sales@example.com',
    organisationName: 'Acme',
    role: 'RECRUITER',
    invitationUrl,
    expiresAt: new Date(Date.now() + 86400000),
  });

  const transport = createSmtpTransport({ host: '127.0.0.1', port: smtpPort });
  const info = await transport.sendMail({
    from: 'no-reply@careeriz.app',
    ...message,
    encoding: TRANSACTIONAL_EMAIL_ENCODING,
  });

  assert.deepEqual(info.accepted, ['sales@example.com']);
  assert.deepEqual(info.rejected, []);

  const received = receivedMessages.at(-1);
  assert.ok(received, 'Expected the local SMTP server to have received a message.');
  assert.match(received.raw, /Content-Transfer-Encoding: base64/);

  const decodedBody = decodeBase64Body(received.raw);
  assert.equal(decodedBody.includes(invitationUrl), true, 'Invitation URL must survive delivery byte-for-byte.');
  assert.equal(decodedBody.includes(`/auth/invitations/accept?token=${rawToken}`), true);
});

test('nodemailer\'s untouched default (quoted-printable) soft-wraps this invitation URL onto more than one wire line - the exact defect class deliverEmail() now avoids via base64', async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const invitationUrl = buildInvitationAcceptUrl('http://localhost:3000', rawToken).toString();
  const message = buildOrganisationInvitationEmailMessage({
    to: 'sales@example.com',
    organisationName: 'Acme',
    role: 'RECRUITER',
    invitationUrl,
    expiresAt: new Date(Date.now() + 86400000),
  });

  const transport = createSmtpTransport({ host: '127.0.0.1', port: smtpPort });
  // Deliberately omits `encoding` to reproduce nodemailer's pre-fix default,
  // proving the regression this fix closes is real and not hypothetical.
  await transport.sendMail({ from: 'no-reply@careeriz.app', ...message });

  const received = receivedMessages.at(-1);
  assert.match(received.raw, /Content-Transfer-Encoding: quoted-printable/);

  const rawBodyLines = received.raw.split('\r\n\r\n').slice(1).join('\r\n\r\n').split('\r\n').filter(Boolean);
  const urlSplitAcrossLines = rawBodyLines.some((line) => /accept=$/.test(line));
  assert.equal(urlSplitAcrossLines, true, 'This ~116-char URL is expected to straddle the ~76-char QP soft-wrap boundary.');
});
