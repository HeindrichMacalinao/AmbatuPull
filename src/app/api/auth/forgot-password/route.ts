import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/erp-db';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const token = await requestPasswordReset(email);

    // In production, this token is sent via email link.
    // For development, we return a generic success message to prevent user enumeration,
    // plus provide the token in dev mode for testing.
    return NextResponse.json({
      message: 'If the provided email is registered, a password recovery link has been generated.',
      debugToken: process.env.NODE_ENV !== 'production' ? token : undefined,
    });
  } catch (err: any) {
    console.error('[API /api/auth/forgot-password] error:', err);
    return NextResponse.json({ error: 'Failed to process password recovery' }, { status: 500 });
  }
}
