'use strict';

import nodemailer from 'nodemailer';

export class EmailConfigError extends Error {
  readonly isConfigError = true;
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigError';
  }
}

export class EmailDeliveryError extends Error {
  readonly isDeliveryError = true;
  constructor(message: string, public readonly cause?: unknown, public readonly rawToken?: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: 'resend' | 'smtp' | 'none';
  error?: string;
  messageId?: string;
}

/**
 * Universal email dispatcher for Hope, Inc. ERP.
 * Supports:
 * 1. Resend API (via RESEND_API_KEY)
 * 2. SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS / SMTP_PASSWORD, SMTP_FROM)
 * 3. Graceful fallback logging when credentials are not yet configured in Vercel.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text } = options;

  const rawKey = process.env.RESEND_API_KEY;
  const resendApiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : '';

  const smtpUser = process.env.SMTP_USER?.trim().replace(/^["']|["']$/g, '');
  const rawSmtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const smtpPass = rawSmtpPass ? rawSmtpPass.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '') : '';
  const smtpHost =
    process.env.SMTP_HOST?.trim().replace(/^["']|["']$/g, '') ||
    (smtpUser?.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : undefined);
  const smtpPort = Number(process.env.SMTP_PORT) || (smtpHost === 'smtp.gmail.com' ? 465 : 587);

  const hasSmtpConfig = Boolean(smtpUser && smtpPass);
  const providerPreference = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

  // Helper: Try SMTP delivery (supports Gmail SMTP, custom SMTP, etc.)
  const trySmtp = async (): Promise<SendEmailResult> => {
    if (!hasSmtpConfig) {
      return {
        sent: false,
        provider: 'smtp',
        error: 'SMTP credentials (SMTP_USER / SMTP_PASS) not configured in environment variables.',
      };
    }

    try {
      const isGmail = smtpHost === 'smtp.gmail.com' || smtpUser?.toLowerCase().endsWith('@gmail.com');
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPass },
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: {
              rejectUnauthorized: process.env.NODE_ENV === 'production',
            },
          });

      const fromHeader =
        process.env.SMTP_FROM || (smtpUser ? `Hope ERP <${smtpUser}>` : process.env.EMAIL_FROM || 'Hope ERP');

      const info = await transporter.sendMail({
        from: fromHeader,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ' '),
      });

      console.log(`[email:smtp] Successfully sent email to ${to} (id: ${info.messageId})`);
      return {
        sent: true,
        provider: 'smtp',
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error('[email:smtp] Failed to send via SMTP:', err);
      return {
        sent: false,
        provider: 'smtp',
        error: err.message || 'Failed to send via SMTP transporter',
      };
    }
  };

  // Helper: Try Resend API delivery
  const tryResend = async (): Promise<SendEmailResult> => {
    if (!resendApiKey) {
      return {
        sent: false,
        provider: 'resend',
        error: 'RESEND_API_KEY not configured in environment variables.',
      };
    }

    let fromAddress = (process.env.EMAIL_FROM || '').trim().replace(/^["']|["']$/g, '');
    if (
      !fromAddress ||
      fromAddress.includes('@gmail.com') ||
      fromAddress.includes('@yahoo.com') ||
      fromAddress.includes('@outlook.com') ||
      fromAddress.includes('@hotmail.com') ||
      !fromAddress.includes('@')
    ) {
      fromAddress = 'Hope ERP <onboarding@resend.dev>';
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ' '),
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        let errorMsg =
          resData.message || resData.error?.message || (typeof resData === 'string' ? resData : JSON.stringify(resData));

        if (typeof errorMsg === 'string' && errorMsg.includes('can only send testing emails to your own email address')) {
          errorMsg = `${errorMsg} (Tip: Configure Gmail SMTP via SMTP_USER & SMTP_PASS in Vercel to send to any email address).`;
        }

        console.error('[email:resend] API error response:', resData);
        return {
          sent: false,
          provider: 'resend',
          error: errorMsg,
        };
      }

      console.log(`[email:resend] Successfully sent email to ${to} (id: ${resData.id})`);
      return {
        sent: true,
        provider: 'resend',
        messageId: resData.id,
      };
    } catch (err: any) {
      console.error('[email:resend] Failed to connect to Resend:', err);
      return {
        sent: false,
        provider: 'resend',
        error: err.message || 'Failed to connect to Resend API',
      };
    }
  };

  // 1. If SMTP is explicitly preferred, or SMTP is configured and user wants universal delivery:
  // (Gmail SMTP can send to ANY recipient in the world without domain restrictions)
  if (providerPreference === 'smtp' || (hasSmtpConfig && providerPreference !== 'resend')) {
    const smtpRes = await trySmtp();
    if (smtpRes.sent) return smtpRes;

    // If SMTP fails, try Resend as fallback if available
    if (resendApiKey) {
      console.warn('[email] SMTP delivery failed, attempting Resend fallback...');
      const resendRes = await tryResend();
      if (resendRes.sent) return resendRes;
    }
    return smtpRes;
  }

  // 2. Otherwise try Resend if configured
  if (resendApiKey) {
    const resendRes = await tryResend();
    if (resendRes.sent) return resendRes;

    // If Resend failed (e.g. sandbox restriction 403 on arbitrary recipient), fall back to SMTP!
    if (hasSmtpConfig) {
      console.warn(`[email] Resend rejected (${resendRes.error}), attempting fallback to SMTP...`);
      const smtpRes = await trySmtp();
      if (smtpRes.sent) return smtpRes;
      return {
        sent: false,
        provider: 'smtp',
        error: `Resend: ${resendRes.error} | SMTP: ${smtpRes.error}`,
      };
    }

    return resendRes;
  }

  // 3. Try SMTP if configured without Resend
  if (hasSmtpConfig) {
    return await trySmtp();
  }

  // 4. No provider configured
  console.warn(
    `[email:none] Email NOT sent to ${to}. Subject: "${subject}". Reason: No email service credentials configured.`
  );
  return {
    sent: false,
    provider: 'none',
    error: 'No active email provider. Please configure Gmail SMTP or RESEND_API_KEY in Vercel.',
  };
}

/**
 * Send 6-digit registration verification OTP email.
 */
export async function sendRegistrationOtpEmail(
  email: string,
  otp: string,
  firstName?: string
): Promise<SendEmailResult> {
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const subject = `Your Hope ERP Verification Code: ${otp}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #0f172a; padding: 28px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
          .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
          .content { padding: 32px; }
          .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; }
          .expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .notice { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; font-size: 13px; color: #1e40af; border-radius: 4px; margin-top: 24px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hope, Inc. ERP</h1>
            <p>Account Security & Identity Verification</p>
          </div>
          <div class="content">
            <div class="greeting">${greeting}</div>
            <div class="text">
              Thank you for registering on the Hope, Inc. Enterprise Resource Planning (ERP) platform. To finalize your corporate account, please verify your email address with the one-time verification code below:
            </div>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="expiry">This code will expire in 15 minutes.</div>
            </div>
            <div class="notice">
              <strong>Security Notice:</strong> Never share this code with anyone. Hope ERP administrators will never ask for your verification code or password.
            </div>
            <div class="text" style="margin-top: 24px; font-size: 13px; color: #64748b;">
              If you did not request this registration, please safely disregard this message.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Hope, Inc. ERP. All rights reserved. Confidential corporate communication.
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Send 6-digit password reset OTP email.
 */
export async function sendPasswordResetOtpEmail(
  email: string,
  otp: string,
  resetLink?: string
): Promise<SendEmailResult> {
  const subject = `Your Hope ERP Password Reset Code: ${otp}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #0f172a; padding: 28px 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
          .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
          .content { padding: 32px; }
          .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #dc2626; }
          .expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 6px; margin: 16px 0; text-align: center; }
          .notice { background: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; font-size: 13px; color: #9f1239; border-radius: 4px; margin-top: 24px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hope, Inc. ERP</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <div class="greeting">Hello,</div>
            <div class="text">
              We received a request to reset your password for your Hope, Inc. ERP account. Use the one-time code below to complete your password reset:
            </div>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="expiry">This verification code will expire in 15 minutes.</div>
            </div>
            ${
              resetLink
                ? `<div style="text-align: center; margin: 20px 0;">
                    <a href="${resetLink}" class="btn" target="_blank">Reset Password Directly &rarr;</a>
                   </div>`
                : ''
            }
            <div class="notice">
              <strong>Security Alert:</strong> If you did not request a password reset, please ignore this email or notify your system administrator immediately. No changes have been made to your account.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Hope, Inc. ERP. All rights reserved. Confidential corporate communication.
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Backward-compatible helper for sendPasswordResetEmail.
 */
export async function sendPasswordResetEmail(options: {
  recipient: string;
  recipientName?: string;
  resetLink: string;
  expiresInMinutes?: number;
}): Promise<boolean> {
  const result = await sendEmail({
    to: options.recipient,
    subject: 'Reset your Hope, Inc. ERP password',
    html: `
      <p>Hello ${options.recipientName || ''},</p>
      <p>We received a request to reset your Hope, Inc. ERP password.</p>
      <p><a href="${options.resetLink}">Choose a new password</a></p>
      <p>This link expires in ${options.expiresInMinutes || 15} minutes and can only be used once.</p>
      <p>If you did not request this change, you can ignore this email.</p>
    `,
    text: `We received a request to reset your Hope, Inc. ERP password. Use this link: ${options.resetLink}`,
  });
  return result.sent;
}
