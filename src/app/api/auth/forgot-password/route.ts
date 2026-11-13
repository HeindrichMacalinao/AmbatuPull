'use strict';

import { NextResponse } from 'next/server';
import { requestPasswordReset, getUserByEmail } from '@/lib/erp-db';
import { generateNumericOtp, createSignedOtpToken } from '@/lib/otp';
import { sendPasswordResetOtpEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);

    // If user does not exist, return generic success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If the provided email is registered, a password recovery code has been sent to your inbox.',
      });
    }

    // 1. Generate 6-digit OTP code
    const otpCode = generateNumericOtp(6);

    // 2. Persist in database (Supabase Cloud + SQLite)
    await requestPasswordReset(cleanEmail, otpCode);

    // 3. Create signed, tamper-evident stateless token (valid across Vercel lambdas)
    const signedToken = createSignedOtpToken({
      email: cleanEmail,
      otp: otpCode,
      purpose: 'reset',
      ttlMinutes: 15,
    });

    // 4. Construct direct reset URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (request.headers.get('origin') ? request.headers.get('origin')! : 'http://localhost:3000');
    const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?email=${encodeURIComponent(cleanEmail)}&token=${otpCode}`;

    // 5. Send live email
    const sendResult = await sendPasswordResetOtpEmail(cleanEmail, otpCode, resetLink);

    return NextResponse.json({
      message: 'If the provided email is registered, a password recovery code has been sent to your inbox.',
      pendingToken: signedToken,
      email: cleanEmail,
      emailSent: sendResult.sent,
      provider: sendResult.provider,
      debugToken: !sendResult.sent || process.env.NODE_ENV !== 'production' ? otpCode : undefined,
    });
  } catch (err: any) {
    console.error('[API /api/auth/forgot-password] error:', err);
    return NextResponse.json({ error: 'Failed to process password recovery request' }, { status: 500 });
  }
}
