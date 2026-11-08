import { NextResponse } from 'next/server';
import { completePasswordReset } from '@/lib/erp-db';

export async function POST(request: Request) {
  try {
    const { token, password, confirmPassword } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    await completePasswordReset(token, password);

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
