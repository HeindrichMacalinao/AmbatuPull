import { NextResponse } from 'next/server';
import { getUserGrantedRights, restoreProduct } from '@/lib/erp-db';

export async function PUT(request: Request, { params }: { params: Promise<{ prodCode: string }> }) {
  try {
    const role = request.headers.get('x-user-role') || 'User';
    if (role !== 'Admin' && role !== 'Superadmin') {
      if (role === 'User') {
        const userId = Number(request.headers.get('x-user-id'));
        if (Number.isInteger(userId) && userId > 0) {
          const rights = await getUserGrantedRights(userId);
          if (!rights.includes('product.restore') && !rights.includes('*')) {
            return NextResponse.json({ error: "Forbidden: missing required permission 'product.restore'" }, { status: 403 });
          }
        } else {
          return NextResponse.json({ error: 'Unauthorized: user identity is required' }, { status: 401 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const { prodCode } = await params;
    const actor = request.headers.get('x-user-email') || role;
    const restored = await restoreProduct({ prodCode, actor });
    return NextResponse.json({ message: 'Product restored successfully', product: restored, ...restored });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to restore product' }, { status: err.status || 500 });
  }
}
