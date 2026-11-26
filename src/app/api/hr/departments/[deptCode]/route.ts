import { NextResponse } from 'next/server';
import { updateDepartment, softDeleteDepartment, getUserGrantedRights } from '@/lib/erp-db';

async function assertDeptRight(request: Request, rightCode: 'dept.edit' | 'dept.delete') {
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ deptCode: string }> }
) {
  try {
    await assertDeptRight(request, 'dept.edit');
    const { deptCode } = await context.params;
    const body = await request.json();
    const deptName = typeof body.deptName === 'string' ? body.deptName.trim() : '';

    if (!deptName) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    if (deptName.length > 100) {
      return NextResponse.json(
        { error: 'Department name must not exceed 100 characters' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const department = await updateDepartment({ deptCode, deptName, actor });

    return NextResponse.json({
      message: 'Department updated successfully',
      department,
      ...department,
    });
  } catch (err: any) {
    console.error('[API PUT /api/hr/departments/[deptCode]] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update department' },
      { status: err.status || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deptCode: string }> }
) {
  try {
    await assertDeptRight(request, 'dept.delete');
    const { deptCode } = await context.params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const department = await softDeleteDepartment({ deptCode, actor });

    return NextResponse.json({
      message: 'Department deleted successfully',
      department,
      ...department,
    });
  } catch (err: any) {
    console.error('[API DELETE /api/hr/departments/[deptCode]] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete department' },
      { status: err.status || 500 }
    );
  }
}
