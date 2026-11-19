import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/erp-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    // Check auth header if provided (e.g. x-user-role)
    const role = request.headers.get('x-user-role') || 'User';

    const products = await getProducts({ search, status, role });
    return NextResponse.json({ products, total: products.length });
  } catch (err: any) {
    console.error('[API GET /api/products] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve products' },
      { status: err.status || 500 }
    );
  }
}
