import { NextResponse } from 'next/server';
import { getJobHistory, createJobHistory, getUserGrantedRights } from '@/lib/erp-db';

async function assertJobHistoryRight(request: Request, rightCode: 'jobhistory.add') {
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

export async function GET(
  request: Request,
  context: { params: Promise<{ empNo: string }> }
) {
  try {
    const { empNo } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const role = request.headers.get('x-user-role') || 'User';

    const result = await getJobHistory({ empNo, status, role });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API GET /api/hr/employees/[empNo]/history] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve job history' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ empNo: string }> }
) {
  try {
    await assertJobHistoryRight(request, 'jobhistory.add');
    const { empNo } = await context.params;
    const body = await request.json();

    const jobCode = typeof body.jobCode === 'string' ? body.jobCode.trim() : '';
    const deptCode = typeof body.deptCode === 'string' ? body.deptCode.trim() : '';
    const effDate = typeof body.effDate === 'string' ? body.effDate.trim() : '';
    const salary = Number(body.salary);

    if (!jobCode || !deptCode || !/^\d{4}-\d{2}-\d{2}$/.test(effDate)) {
      return NextResponse.json(
        { error: 'jobCode, deptCode, and valid effDate (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(salary) || salary <= 0) {
      return NextResponse.json({ error: 'salary must be a positive number' }, { status: 400 });
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const record = await createJobHistory({ empNo, jobCode, deptCode, effDate, salary, actor });

    return NextResponse.json(
      { message: 'Job history record created successfully', record, ...record },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/hr/employees/[empNo]/history] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create job history record' },
      { status: err.status || 500 }
    );
  }
}
