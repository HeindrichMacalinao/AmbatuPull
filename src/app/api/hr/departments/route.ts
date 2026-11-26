import { NextResponse } from 'next/server';
import { getDepartments, createDepartment, getUserGrantedRights } from '@/lib/erp-db';

async function assertDeptRight(request: Request, rightCode: 'dept.add' | 'dept.edit' | 'dept.delete') {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;

  if (role !== 'User') {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw Object.assign(new Error('Unauthorized: user identity is required'), { status: 401 });
  }

  const rights = await getUserGrantedRights(userId);
  if (!rights.includes(rightCode) && !rights.includes('*')) {
    throw Object.assign(new Error(`Forbidden: missing required permission '${rightCode}'`), { status: 403 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const role = request.headers.get('x-user-role') || 'User';

    const result = await getDepartments({ search, status, role });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API GET /api/hr/departments] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve departments' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertDeptRight(request, 'dept.add');

    const body = await request.json();
    const deptCode = typeof body.deptCode === 'string' ? body.deptCode.trim() : '';
    const deptName = typeof body.deptName === 'string' ? body.deptName.trim() : '';

    if (!deptCode || !deptName) {
      return NextResponse.json(
        { error: 'Department code and department name are required' },
        { status: 400 }
      );
    }

    if (deptCode.length > 10) {
      return NextResponse.json(
        { error: 'Department code must not exceed 10 characters' },
        { status: 400 }
      );
    }

    if (deptName.length > 100) {
      return NextResponse.json(
        { error: 'Department name must not exceed 100 characters' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const department = await createDepartment({ deptCode, deptName, actor });

    return NextResponse.json(
      { message: 'Department created successfully', department, ...department },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/hr/departments] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create department' },
      { status: err.status || 500 }
    );
  }
}
