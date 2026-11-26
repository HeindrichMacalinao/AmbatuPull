import { NextResponse } from 'next/server';
import { restoreDepartment } from '@/lib/erp-db';

async function handleRestore(
  request: Request,
  context: { params: Promise<{ deptCode: string }> }
) {
  try {
    const role = request.headers.get('x-user-role') || 'User';
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore departments' },
        { status: 403 }
      );
    }

    const { deptCode } = await context.params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const department = await restoreDepartment({ deptCode, actor });

    return NextResponse.json({
      message: 'Department restored successfully',
      department,
      ...department,
    });
  } catch (err: any) {
    console.error('[API RESTORE /api/hr/departments/[deptCode]/restore] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to restore department' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ deptCode: string }> }
) {
  return handleRestore(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ deptCode: string }> }
) {
  return handleRestore(request, context);
}
