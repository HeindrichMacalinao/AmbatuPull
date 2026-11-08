import { NextResponse } from 'next/server';
import { getUsers, createUser } from '@/lib/erp-db';
import type { RoleName } from '@/types/erp';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;

    const users = await getUsers({ search, role });
    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('[API GET /api/users] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve user accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, password, role, empNo } = body;

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'First name, last name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    const assignedRole: RoleName = role || 'User';

    const newUser = await createUser({
      firstName,
      lastName,
      email,
      password,
      role: assignedRole,
      empNo: empNo || null,
      actor: 'admin_panel',
    });

    return NextResponse.json(
      { message: 'User account created successfully', user: newUser },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status === 409 || err.message?.includes('already registered')) {
      return NextResponse.json(
        { error: 'Email address is already in use' },
        { status: 409 }
      );
    }
    console.error('[API POST /api/users] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create user' },
      { status: err.status || 500 }
    );
  }
}
