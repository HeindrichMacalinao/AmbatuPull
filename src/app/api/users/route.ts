import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase/admin';

// In-memory fallback dataset for seamless initial testing before Supabase project is configured
let inMemoryUsers = [
  {
    userId: 1,
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@hope-erp.local',
    role: 'Superadmin',
    isBlocked: false,
    status: 'Active',
    empNo: 'EMP001',
    stamp: 'SYSTEM_INIT',
  },
  {
    userId: 2,
    firstName: 'Operations',
    lastName: 'Admin',
    email: 'admin@hope-erp.local',
    role: 'Admin',
    isBlocked: false,
    status: 'Active',
    empNo: 'EMP002',
    stamp: 'SYSTEM_INIT',
  },
  {
    userId: 3,
    firstName: 'Standard',
    lastName: 'Staff',
    email: 'user@hope-erp.local',
    role: 'User',
    isBlocked: false,
    status: 'Active',
    empNo: 'EMP003',
    stamp: 'SYSTEM_INIT',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase();
  const role = searchParams.get('role');

  try {
    const supabase = getAdminClient();
    let query = supabase
      .from('app_user')
      .select('userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp');

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (data && !error && data.length > 0) {
      let filtered = data;
      if (search) {
        filtered = filtered.filter(
          (u) =>
            u.firstName?.toLowerCase().includes(search) ||
            u.lastName?.toLowerCase().includes(search) ||
            u.email?.toLowerCase().includes(search)
        );
      }
      return NextResponse.json({ users: filtered, source: 'supabase' });
    }
  } catch {
    // Proceed to fallback
  }

  // Fallback
  let filtered = [...inMemoryUsers];
  if (role && role !== 'all') {
    filtered = filtered.filter((u) => u.role === role);
  }
  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.firstName.toLowerCase().includes(search) ||
        u.lastName.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ users: filtered, source: 'in-memory-fallback' });
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

    const cleanEmail = String(email).trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);
    const assignedRole = role || 'User';

    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('app_user')
        .insert({
          firstName,
          lastName,
          email: cleanEmail,
          passwordHash: hash,
          role: assignedRole,
          empNo: empNo || null,
          isBlocked: false,
          status: 'Active',
          stamp: `USER_ADD_${Date.now()}`,
        })
        .select()
        .single();

      if (data && !error) {
        const { passwordHash, ...safeUser } = data;
        return NextResponse.json({ user: safeUser, source: 'supabase' }, { status: 201 });
      }
    } catch {
      // Proceed to fallback
    }

    const newId = inMemoryUsers.length > 0 ? Math.max(...inMemoryUsers.map((u) => u.userId)) + 1 : 1;
    const newUser = {
      userId: newId,
      firstName,
      lastName,
      email: cleanEmail,
      role: assignedRole,
      isBlocked: false,
      status: 'Active',
      empNo: empNo || null,
      stamp: `USER_ADD_${Date.now()}`,
    };
    inMemoryUsers.push(newUser);

    return NextResponse.json({ user: newUser, source: 'in-memory-fallback' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create user' }, { status: 500 });
  }
}
