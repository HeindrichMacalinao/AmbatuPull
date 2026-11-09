import nodemailer from 'nodemailer';

type PasswordResetEmail = {
  recipient: string;
  recipientName?: string;
  resetLink: string;
  expiresInMinutes: number;
};

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const hasAnySmtpSetting = Boolean(
    host ||
      process.env.SMTP_USER ||
      process.env.SMTP_PASSWORD
  );

  if (!host || !from) {
    if (isProduction() || hasAnySmtpSetting) {
      throw new Error('SMTP_HOST and SMTP_FROM must be configured for email delivery');
    }
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }

  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    from,
    auth: user && password ? { user, pass: password } : undefined,
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] || character
  );
}

export async function sendPasswordResetEmail({
  recipient,
  recipientName,
  resetLink,
  expiresInMinutes,
}: PasswordResetEmail): Promise<boolean> {
  const config = getEmailConfig();

  if (!config) {
    console.info(`[email] SMTP is not configured; password reset link: ${resetLink}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : 'Hello,';

  await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject: 'Reset your Hope, Inc. ERP password',
    text: [
      recipientName ? `Hello ${recipientName},` : 'Hello,',
      '',
      'We received a request to reset your Hope, Inc. ERP password.',
      `Use this link to choose a new password: ${resetLink}`,
      `This link expires in ${expiresInMinutes} minutes and can only be used once.`,
      '',
      'If you did not request this change, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>${greeting}</p>
      <p>We received a request to reset your Hope, Inc. ERP password.</p>
      <p><a href="${escapeHtml(resetLink)}">Choose a new password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes and can only be used once.</p>
      <p>If you did not request this change, you can ignore this email.</p>
    `,
  });

  return true;
}
