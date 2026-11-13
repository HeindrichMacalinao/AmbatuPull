'use strict';

import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetEmail = searchParams.get('to');

  const rawKey = process.env.RESEND_API_KEY;
  const cleanKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : null;
  const emailFrom = process.env.EMAIL_FROM || 'Hope ERP <onboarding@resend.dev>';

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    resendKeyConfigured: Boolean(cleanKey),
    resendKeyPrefix: cleanKey ? cleanKey.substring(0, 6) + '...' : null,
    emailFromConfigured: emailFrom,
    smtpHostConfigured: Boolean(process.env.SMTP_HOST),
  };

  if (!targetEmail) {
    return NextResponse.json({
      message: 'Email diagnostics status. Pass ?to=your-email@example.com in URL to trigger a live test email.',
      diagnostics,
    });
  }

  const result = await sendEmail({
    to: targetEmail.trim(),
    subject: 'Hope ERP — Live Email Delivery Test',
    html: `
      <h2>Live Email Delivery Test Successful!</h2>
      <p>This email confirms that your Resend API integration on Vercel is working correctly.</p>
      <p>Sent at: ${new Date().toISOString()}</p>
    `,
    text: 'Live Email Delivery Test Successful! Your email integration on Vercel is working.',
  });

  return NextResponse.json({
    diagnostics,
    testRecipient: targetEmail,
    deliveryResult: result,
  });
}
