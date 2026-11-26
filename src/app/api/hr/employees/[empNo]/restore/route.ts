import { NextResponse } from 'next/server';
import { restoreEmployee } from '@/lib/erp-db';

async function handleRestore(
  request: Request,
  context: { params: Promise<{ empNo: string }> }
) {
  try {
    const role = request.headers.get('x-user-role') || 'User';
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore employees' },
        { status: 403 }
      );
    }

    const { empNo } = await context.params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const employee = await restoreEmployee({ empNo, actor });

    return NextResponse.json({
      message: 'Employee restored successfully',
      employee,
      ...employee,
    });
  } catch (err: any) {
    console.error('[API RESTORE /api/hr/employees/[empNo]/restore] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to restore employee' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ empNo: string }> }
) {
  return handleRestore(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ empNo: string }> }
) {
  return handleRestore(request, context);
}
