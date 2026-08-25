import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { SMTPServer } from 'smtp-server';

// This project's own transport-selection logic (__resolveEmailTransportInfo)
// always resolves to the in-memory fake transport while running under this
// repo's `node --test` runner (see emailService.js and
// phase1-security.test.js's "uses the isolated test transport even when SMTP
// env vars are configured" test) - a deliberate safety feature that must not
// be bypassed just to exercise a real SMTP handshake in a test.
//
// So instead of forcing the app's singleton transport into SMTP mode, this
// test builds the exact same message content the app would send
// (buildPasswordResetEmailMessage / buildPasswordResetOtpEmailMessage) and
// hands it to the exact same transport-construction function
// (createSmtpTransport) used in production, pointed at a real local SMTP
// listener. It proves the reset-link and OTP emails are genuinely ACCEPTED
// over real SMTP protocol by a receiving server, not just resolved by an
// in-memory mock.

let createSmtpTransport;
let buildPasswordResetEmailMessage;
let buildPasswordResetOtpEmailMessage;

let smtpServer;
let smtpPort;
const receivedMessages = [];

// nodemailer's default quoted-printable transfer encoding soft-wraps long
// plaintext lines (`=\r\n` continuation) and escapes literal '=' as '=3D' -
// unwrap both so assertions can match the original text.
function decodeQuotedPrintableBody(raw) {
  const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
  return body.replace(/=\r\n/g, '').replace(/=3D/g, '=');
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.JWT_SECRET = '12345678901234567890123456789012';

  ({ createSmtpTransport, buildPasswordResetEmailMessage, buildPasswordResetOtpEmailMessage } =
    await import('../services/emailService.js'));

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

test('the password-reset link email is genuinely accepted over real SMTP by a receiving server', async () => {
  const transport = createSmtpTransport({ host: '127.0.0.1', port: smtpPort });
  const message = buildPasswordResetEmailMessage('candidate@example.com', 'a'.repeat(64));

  const info = await transport.sendMail({ from: 'no-reply@careeriz.app', ...message });

  assert.deepEqual(info.accepted, ['candidate@example.com']);
  assert.deepEqual(info.rejected, []);

  const received = receivedMessages.at(-1);
  assert.ok(received, 'Expected the local SMTP server to have received a message.');
  assert.equal(received.from, 'no-reply@careeriz.app');
  assert.deepEqual(received.to, ['candidate@example.com']);
  assert.match(received.raw, /Reset your Careeriz password/);
  assert.match(decodeQuotedPrintableBody(received.raw), /password-reset\/start\?token=/);
});

test('the password-reset OTP email is genuinely accepted over real SMTP by a receiving server', async () => {
  const transport = createSmtpTransport({ host: '127.0.0.1', port: smtpPort });
  const message = buildPasswordResetOtpEmailMessage('recruiter@company.com', '482913');

  const info = await transport.sendMail({ from: 'no-reply@careeriz.app', ...message });

  assert.deepEqual(info.accepted, ['recruiter@company.com']);
  assert.deepEqual(info.rejected, []);

  const received = receivedMessages.at(-1);
  assert.ok(received, 'Expected the local SMTP server to have received a message.');
  assert.match(received.raw, /Your verification code is 482913/);
});

test('the local SMTP server genuinely rejects delivery to an address it is configured to refuse, proving acceptance is not a no-op mock', async () => {
  const rejectingServer = new SMTPServer({
    disabledCommands: ['AUTH', 'STARTTLS'],
    onRcptTo(address, session, callback) {
      callback(new Error('550 No such user'));
    },
    onData(stream, session, callback) {
      stream.on('data', () => {});
      stream.on('end', callback);
    },
  });

  await new Promise((resolve, reject) => {
    rejectingServer.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const rejectingPort = rejectingServer.server.address().port;

  try {
    const transport = createSmtpTransport({ host: '127.0.0.1', port: rejectingPort });
    const message = buildPasswordResetEmailMessage('ghost@example.com', 'b'.repeat(64));

    await assert.rejects(
      () => transport.sendMail({ from: 'no-reply@careeriz.app', ...message }),
      /No such user|550/
    );
  } finally {
    await new Promise((resolve) => rejectingServer.close(resolve));
  }
});
