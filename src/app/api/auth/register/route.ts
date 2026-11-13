import { NextResponse } from 'next/server';
import { createUser } from '@/lib/erp-db';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 1. Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const confirmPassword = body.confirmPassword || password;
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Password and Confirm Password do not match' },
        { status: 400 }
      );
    }

    const firstName = (body.firstName || 'User').trim();
    const lastName = (body.lastName || 'Account').trim();

    // 2. Create user (forced to 'User' role per Student Guide §1.2 & §3.1)
    const newUser = await createUser({
      firstName,
      lastName,
      email: cleanEmail,
      password,
      role: 'User',
      actor: 'self',
    });

    return NextResponse.json(
      {
        message: 'Registration successful! You may now sign in with your credentials.',
        user: newUser,
        ...newUser,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status === 409 || err.code === '23505' || err.message?.includes('already registered')) {
      return NextResponse.json(
        { error: 'An account with this email address is already registered.' },
        { status: 409 }
      );
    }
    console.error('[API /api/auth/register] error:', err);
    return NextResponse.json(
      { error: 'Registration failed due to a server error. Please try again later.' },
      { status: err.status && err.status < 500 ? err.status : 500 }
    );
  }
}
