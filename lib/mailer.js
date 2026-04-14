const nodemailer = require('nodemailer');

let cachedTransport = null;
let warnedMissingConfig = false;

function createTransport() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  return null;
}

function getTransport() {
  if (!cachedTransport) {
    cachedTransport = createTransport();
  }
  return cachedTransport;
}

function getFromAddress() {
  const raw = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@cssgroup.local';
  // If already formatted as "Name <addr>", use as-is. Otherwise wrap with a display name.
  if (raw.includes('<')) return raw;
  const displayName = process.env.MAIL_FROM_NAME || 'CSS RMS';
  return `"${displayName}" <${raw}>`;
}

async function sendEmail({ to, subject, text, html, bcc, replyTo }) {
  const transport = getTransport();
  if (!transport) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn('[MAIL] Email transport not configured. Set GMAIL_USER/GMAIL_APP_PASSWORD or SMTP_* env vars.');
    }
    return { skipped: true };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : to;
  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
    return { skipped: true };
  }

  return transport.sendMail({
    from: getFromAddress(),
    to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
    bcc,
    replyTo,
    subject,
    text,
    html
  });
}

module.exports = { sendEmail };
