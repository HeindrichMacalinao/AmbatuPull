import { NextResponse } from 'next/server';
import { restoreCustomer } from '@/lib/erp-db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ custNo: string }> }
) {
  try {
    const { custNo } = await params;
    const role = request.headers.get('x-user-role');
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore customers' },
        { status: 403 }
      );
    }

    const actor = request.headers.get('x-user-email') || role || 'system';

    const restored = await restoreCustomer({
      custNo,
      actor,
    });

    return NextResponse.json({
      message: 'Customer restored successfully',
      customer: restored,
      ...restored,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to restore customer' },
      { status: err.status || 500 }
    );
  }
}
