import http from 'node:http';
import { SMTPServer } from 'smtp-server';

// A small real SMTP listener + HTTP peek API used only by Playwright e2e
// specs for this repo's password-reset/OTP flow. The backend's own
// transport-selection logic always resolves to an in-memory fake transport
// while running under `node --test` (see emailService.js), which is correct
// for unit tests but means unit tests never exercise a real SMTP handshake
// for the running e2e backend process. Pointing the e2e backend's
// SMTP_HOST/SMTP_PORT at this catcher instead makes the e2e run send actual
// password-reset and OTP emails over real SMTP to a real (local) listener,
// which the e2e spec then reads back via HTTP to extract the reset-link
// token / OTP code - the same "grab it from the transport" technique the
// backend unit tests use against the fake transport, but here against a
// genuine SMTP acceptance path end to end.

const SMTP_PORT = Number(process.env.E2E_SMTP_CATCHER_PORT || 2525);
const HTTP_PORT = Number(process.env.E2E_SMTP_CATCHER_HTTP_PORT || 2526);

const messages = [];

const smtpServer = new SMTPServer({
  disabledCommands: ['AUTH', 'STARTTLS'],
  onData(stream, session, callback) {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const bodyStart = raw.indexOf('\r\n\r\n');
      const headers = bodyStart === -1 ? raw : raw.slice(0, bodyStart);
      const rawBody = bodyStart === -1 ? '' : raw.slice(bodyStart + 4);
      const subjectMatch = headers.match(/^Subject: (.*)$/mi);
      const text = rawBody.replace(/=\r\n/g, '').replace(/=3D/gi, '=');

      messages.push({
        to: session.envelope.rcptTo.map((entry) => entry.address),
        from: session.envelope.mailFrom?.address,
        subject: subjectMatch ? subjectMatch[1].trim() : '',
        text,
        receivedAt: new Date().toISOString(),
      });
      callback();
    });
  },
});

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/messages') {
    const to = url.searchParams.get('to');
    const matching = to ? messages.filter((message) => message.to.includes(to)) : messages;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(matching));
    return;
  }

  if (url.pathname === '/reset' && req.method === 'POST') {
    messages.length = 0;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

await new Promise((resolve, reject) => {
  smtpServer.listen(SMTP_PORT, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
});

await new Promise((resolve, reject) => {
  httpServer.listen(HTTP_PORT, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
});

console.log(`[e2e-smtp-catcher] SMTP listening on 127.0.0.1:${SMTP_PORT}, HTTP peek API on 127.0.0.1:${HTTP_PORT}`);
