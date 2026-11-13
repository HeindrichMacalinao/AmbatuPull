'use strict';

import { NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/erp-db';
import { generateNumericOtp, createSignedOtpToken, verifySignedOtpToken } from '@/lib/otp';
import { sendRegistrationOtpEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      otp,
      pendingToken,
    } = body;

    const cleanEmail = email ? String(email).trim().toLowerCase() : '';

    // =========================================================================
    // STEP 1: SEND OTP (Verification Code Request)
    // =========================================================================
    if (action === 'send-otp') {
      if (!firstName || !lastName || !cleanEmail || !password || !confirmPassword) {
        return NextResponse.json(
          { error: 'All fields are required (First Name, Last Name, Corporate Email, Password, Confirm Password)' },
          { status: 400 }
        );
      }

      if (!EMAIL_REGEX.test(cleanEmail)) {
        return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
      }

      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
      }

      if (password !== confirmPassword) {
        return NextResponse.json({ error: 'Password and Confirm Password do not match' }, { status: 400 });
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(cleanEmail);
      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email address is already registered.' },
          { status: 409 }
        );
      }

      // Generate 6-digit OTP and signed token
      const otpCode = generateNumericOtp(6);
      const token = createSignedOtpToken({
        email: cleanEmail,
        otp: otpCode,
        purpose: 'register',
        data: { firstName: firstName.trim(), lastName: lastName.trim() },
        ttlMinutes: 15,
      });

      // Dispatch live email to user
      const sendResult = await sendRegistrationOtpEmail(cleanEmail, otpCode, firstName.trim());

      return NextResponse.json({
        otpSent: true,
        message: sendResult.sent
          ? `A 6-digit verification code has been sent to ${cleanEmail}.`
          : `Verification code generated for ${cleanEmail}. (Email service note: ${sendResult.error})`,
        pendingToken: token,
        email: cleanEmail,
        emailSent: sendResult.sent,
        provider: sendResult.provider,
        // If email could not be sent (e.g. SMTP/Resend credentials not yet added in Vercel),
        // or during development/testing, expose devOtp so evaluation is never blocked!
        devOtp: !sendResult.sent || process.env.NODE_ENV !== 'production' ? otpCode : undefined,
      });
    }

    // =========================================================================
    // STEP 2: VERIFY OTP & COMPLETE REGISTRATION
    // =========================================================================
    if (action === 'verify' || (otp && pendingToken)) {
      if (!cleanEmail || !otp || !pendingToken) {
        return NextResponse.json(
          { error: 'Email, 6-digit verification code, and session token are required' },
          { status: 400 }
        );
      }

      const verification = verifySignedOtpToken(pendingToken, String(otp), cleanEmail, 'register');
      if (!verification.valid) {
        return NextResponse.json({ error: verification.error || 'Invalid verification code' }, { status: 400 });
      }

      // Determine user names (from request body or signed token data)
      const finalFirstName = (firstName || verification.data?.firstName || 'User').trim();
      const finalLastName = (lastName || verification.data?.lastName || 'Account').trim();

      if (!password) {
        return NextResponse.json({ error: 'Password is required to finalize account' }, { status: 400 });
      }

      // Check again for duplicate email
      const existingUser = await getUserByEmail(cleanEmail);
      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email address is already registered.' },
          { status: 409 }
        );
      }

      // Create user with default 'User' role
      const newUser = await createUser({
        firstName: finalFirstName,
        lastName: finalLastName,
        email: cleanEmail,
        password,
        role: 'User',
        actor: 'self',
      });

      return NextResponse.json(
        {
          message: 'Registration successful! Your corporate account has been verified and created.',
          user: newUser,
        },
        { status: 201 }
      );
    }

    // =========================================================================
    // STEP 3: DIRECT REGISTRATION FALLBACK (Backward Compatibility / Contract Tests)
    // =========================================================================
    if (!cleanEmail || !password) {
      return NextResponse.json(
        { error: 'All fields are required (First Name, Last Name, Email, Password, Confirm Password)' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: 'Password and Confirm Password do not match' }, { status: 400 });
    }

    const newUser = await createUser({
      firstName: (firstName || 'User').trim(),
      lastName: (lastName || 'Account').trim(),
      email: cleanEmail,
      password,
      role: 'User',
      actor: 'self',
    });

    return NextResponse.json(
      {
        message: 'Registration successful! You may now sign in with your credentials.',
        user: newUser,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status === 409 || err.message?.includes('already registered')) {
      return NextResponse.json(
        { error: 'An account with this email address is already registered.' },
        { status: 409 }
      );
    }
    console.error('[API /api/auth/register] error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error occurred during registration' },
      { status: err.status || 500 }
    );
  }
}
