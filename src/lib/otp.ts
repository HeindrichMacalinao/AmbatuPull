'use strict';

import crypto from 'crypto';

const DEFAULT_SECRET = process.env.SESSION_SECRET || 'ambatu_development_secret_key_change_in_production_32chars';

export interface OtpPayload {
  email: string;
  otpHash: string;
  purpose: 'register' | 'reset';
  exp: number; // Unix timestamp in ms
  data?: Record<string, any>;
}

/**
 * Generate a cryptographically random 6-digit numeric OTP code.
 */
export function generateNumericOtp(digits = 6): string {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Create a signed, tamper-evident stateless OTP token.
 * This guarantees verification works across all serverless Vercel function instances.
 */
export function createSignedOtpToken(options: {
  email: string;
  otp: string;
  purpose: 'register' | 'reset';
  data?: Record<string, any>;
  ttlMinutes?: number;
}): string {
  const { email, otp, purpose, data, ttlMinutes = 15 } = options;
  const cleanEmail = email.trim().toLowerCase();
  const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
  const exp = Date.now() + ttlMinutes * 60 * 1000;

  const payload: OtpPayload = {
    email: cleanEmail,
    otpHash,
    purpose,
    exp,
    data,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', DEFAULT_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed OTP token against submitted email and OTP code.
 */
export function verifySignedOtpToken(
  token: string,
  submittedOtp: string,
  email: string,
  expectedPurpose: 'register' | 'reset'
): { valid: boolean; error?: string; data?: Record<string, any> } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing verification token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed verification token format' };
  }

  const [payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', DEFAULT_SECRET)
    .update(payloadB64)
    .digest('base64url');

  // Constant-time comparison
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid verification token signature' };
  }

  let payload: OtpPayload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'Invalid token payload' };
  }

  // Check expiration
  if (Date.now() > payload.exp) {
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Check email
  if (payload.email !== email.trim().toLowerCase()) {
    return { valid: false, error: 'Verification code does not match the provided email address' };
  }

  // Check purpose
  if (payload.purpose !== expectedPurpose) {
    return { valid: false, error: 'Verification code is invalid for this operation' };
  }

  // Check OTP
  const submittedOtpHash = crypto.createHash('sha256').update(submittedOtp.trim()).digest('hex');
  const hashBuf = Buffer.from(submittedOtpHash);
  const targetBuf = Buffer.from(payload.otpHash);

  if (hashBuf.length !== targetBuf.length || !crypto.timingSafeEqual(hashBuf, targetBuf)) {
    return { valid: false, error: 'Incorrect 6-digit verification code' };
  }

  return { valid: true, data: payload.data };
}
