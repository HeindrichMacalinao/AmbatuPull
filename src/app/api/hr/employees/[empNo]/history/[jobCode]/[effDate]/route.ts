import { NextResponse } from 'next/server';
import { updateJobHistory, softDeleteJobHistory, getUserGrantedRights } from '@/lib/erp-db';

async function assertJobHistoryRight(request: Request, rightCode: 'jobhistory.edit' | 'jobhistory.delete') {
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
  context: { params: Promise<{ empNo: string; jobCode: string; effDate: string }> }
) {
  try {
    await assertJobHistoryRight(request, 'jobhistory.edit');
    const { empNo, jobCode, effDate } = await context.params;
    const body = await request.json();

    const deptCode = typeof body.deptCode === 'string' ? body.deptCode.trim() : '';
    const salary = Number(body.salary);

    if (!deptCode || !Number.isFinite(salary) || salary <= 0) {
      return NextResponse.json(
        { error: 'deptCode and positive salary are required' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const record = await updateJobHistory({ empNo, jobCode, effDate, deptCode, salary, actor });

    return NextResponse.json({
      message: 'Job history record updated successfully',
      record,
      ...record,
    });
  } catch (err: any) {
    console.error('[API PUT /api/hr/employees/[empNo]/history/[jobCode]/[effDate]] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update job history record' },
      { status: err.status || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ empNo: string; jobCode: string; effDate: string }> }
) {
  try {
    await assertJobHistoryRight(request, 'jobhistory.delete');
    const { empNo, jobCode, effDate } = await context.params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const record = await softDeleteJobHistory({ empNo, jobCode, effDate, actor });

    return NextResponse.json({
      message: 'Job history record deleted successfully',
      record,
      ...record,
    });
  } catch (err: any) {
    console.error('[API DELETE /api/hr/employees/[empNo]/history/[jobCode]/[effDate]] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete job history record' },
      { status: err.status || 500 }
    );
  }
}
