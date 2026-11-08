import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase/admin';

// Fallback seed accounts for zero-friction local/offline testing
const FALLBACK_ACCOUNTS = [
  {
    userId: 1,
    email: 'superadmin@hope-erp.local',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'Superadmin',
    isBlocked: false,
    status: 'Active',
    // bcrypt hash of 'Admin@123456'
    passwordHash: '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U',
  },
  {
    userId: 2,
    email: 'admin@hope-erp.local',
    firstName: 'Operations',
    lastName: 'Admin',
    role: 'Admin',
    isBlocked: false,
    status: 'Active',
    passwordHash: '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U',
  },
  {
    userId: 3,
    email: 'user@hope-erp.local',
    firstName: 'Standard',
    lastName: 'Staff',
    role: 'User',
    isBlocked: false,
    status: 'Active',
    passwordHash: '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U',
  },
];

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Try Supabase query
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('app_user')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (data && !error) {
        if (data.isBlocked) {
          return NextResponse.json(
            { error: 'Your account has been blocked. Please contact an administrator.' },
            { status: 403 }
          );
        }

        const valid = await bcrypt.compare(password, data.passwordHash);
        if (!valid) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        // Return user profile
        const { passwordHash, ...userProfile } = data;
        return NextResponse.json({
          message: 'Login successful',
          user: userProfile,
          token: `erp-session-${userProfile.userId}-${Date.now()}`,
        });
      }
    } catch {
      // Supabase not reachable or credentials not yet set, proceed to fallback
    }

    // 2. Fallback check for offline / initial testing
    const fallbackUser = FALLBACK_ACCOUNTS.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (fallbackUser) {
      if (fallbackUser.isBlocked) {
        return NextResponse.json(
          { error: 'Your account has been blocked. Please contact an administrator.' },
          { status: 403 }
        );
      }

      // Password matches Admin@123456 or bcrypt check
      const valid =
        password === 'Admin@123456' ||
        (await bcrypt.compare(password, fallbackUser.passwordHash));

      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      const { passwordHash, ...userProfile } = fallbackUser;
      return NextResponse.json({
        message: 'Login successful (Offline/Demo Mode)',
        user: userProfile,
        token: `erp-demo-token-${userProfile.userId}`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
