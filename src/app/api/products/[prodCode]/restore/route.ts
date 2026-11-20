import { NextResponse } from 'next/server';
import { restoreProduct } from '@/lib/erp-db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ prodCode: string }> }
) {
  try {
    const { prodCode } = await params;
    const role = request.headers.get('x-user-role');
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore products' },
        { status: 403 }
      );
    }

    const actor = request.headers.get('x-user-email') || role || 'system';

    const restored = await restoreProduct({
      prodCode,
      actor,
    });

    return NextResponse.json({
      message: 'Product restored successfully',
      product: restored,
      ...restored,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to restore product' },
      { status: err.status || 500 }
    );
  }
}
