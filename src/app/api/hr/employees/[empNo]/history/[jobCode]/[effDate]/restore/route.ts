import { NextResponse } from 'next/server';
import { restoreJobHistory } from '@/lib/erp-db';

async function handleRestore(
  request: Request,
  context: { params: Promise<{ empNo: string; jobCode: string; effDate: string }> }
) {
  try {
    const role = request.headers.get('x-user-role') || 'User';
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore job history' },
        { status: 403 }
      );
    }

    const { empNo, jobCode, effDate } = await context.params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const record = await restoreJobHistory({ empNo, jobCode, effDate, actor });

    return NextResponse.json({
      message: 'Job history record restored successfully',
      record,
      ...record,
    });
  } catch (err: any) {
    console.error('[API RESTORE /api/hr/employees/[empNo]/history/[jobCode]/[effDate]/restore] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to restore job history record' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ empNo: string; jobCode: string; effDate: string }> }
) {
  return handleRestore(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ empNo: string; jobCode: string; effDate: string }> }
) {
  return handleRestore(request, context);
}
