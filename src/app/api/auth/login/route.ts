import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/erp-db';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Corporate email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid corporate email or password' },
        { status: 401 }
      );
    }

    // Account Status & Block Checks
    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact a system administrator.' },
        { status: 403 }
      );
    }

    if (user.status !== 'Active') {
      return NextResponse.json(
        { error: 'Your account is inactive. Please contact system support.' },
        { status: 403 }
      );
    }

    // Password verification
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid corporate email or password' },
        { status: 401 }
      );
    }

    const { passwordHash, ...userProfile } = user;
    const sessionToken = Buffer.from(
      JSON.stringify({ userId: userProfile.userId, email: userProfile.email, role: userProfile.role, ts: Date.now() })
    ).toString('base64');

    const response = NextResponse.json({
      message: 'Authentication successful',
      user: userProfile,
      token: sessionToken,
    });

    // Set HTTP-only cookie for session persistence
    response.cookies.set('erp_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('[API /api/auth/login] error:', err);
    return NextResponse.json(
      { error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
