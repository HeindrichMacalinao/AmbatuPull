'use strict';

import { NextResponse } from 'next/server';
import { completePasswordReset } from '@/lib/erp-db';
import { verifySignedOtpToken } from '@/lib/otp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, otp, email, pendingToken, password, newPassword, confirmPassword } = body;

    const tokenOrOtp = (token || otp || '').trim();
    const passwordToSet = newPassword || password;

    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Verification code or reset token is required' }, { status: 400 });
    }

    if (!passwordToSet) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    if (passwordToSet.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    if (confirmPassword && passwordToSet !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // 1. If a signed stateless pendingToken is provided, verify it
    if (pendingToken && email) {
      const verification = verifySignedOtpToken(pendingToken, tokenOrOtp, email, 'reset');
      if (!verification.valid) {
        return NextResponse.json({ error: verification.error || 'Invalid verification code' }, { status: 400 });
      }
    }

    // 2. Complete password reset in Supabase Cloud & SQLite
    await completePasswordReset(tokenOrOtp, passwordToSet, email);

    return NextResponse.json({
      message: 'Password has been successfully updated. You may now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('[API /api/auth/reset-password] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to reset password' },
      { status: err.status || 400 }
    );
  }
}
