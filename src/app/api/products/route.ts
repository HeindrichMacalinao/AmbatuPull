import { NextResponse } from 'next/server';
import { getProducts, createProduct, ALLOWED_PRODUCT_UNITS, getUserGrantedRights } from '@/lib/erp-db';

async function assertAddProductRight(request: Request) {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;

  if (role !== 'User') {
    const error = new Error('Forbidden');
    (error as any).status = 403;
    throw error;
  }

  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error('Unauthorized: user identity is required');
    (error as any).status = 401;
    throw error;
  }

  const rights = await getUserGrantedRights(userId);
  if (!rights.includes('product.add') && !rights.includes('*')) {
    const error = new Error("Forbidden: missing required permission 'product.add'");
    (error as any).status = 403;
    throw error;
  }
}

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

export async function POST(request: Request) {
  try {
    await assertAddProductRight(request);

    const body = await request.json();
    const { prodCode, description, unit } = body;

    const trimmedCode = typeof prodCode === 'string' ? prodCode.trim() : '';
    if (!trimmedCode || trimmedCode.length > 10) {
      return NextResponse.json(
        { error: 'Product code is required and must not exceed 10 characters' },
        { status: 400 }
      );
    }

    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: 'Product code must contain only alphanumeric characters, dashes, or underscores' },
        { status: 400 }
      );
    }

    const trimmedDesc = typeof description === 'string' ? description.trim() : '';
    if (!trimmedDesc || trimmedDesc.length > 100) {
      return NextResponse.json(
        { error: 'Description is required and must not exceed 100 characters' },
        { status: 400 }
      );
    }

    const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
    const matchedUnit = ALLOWED_PRODUCT_UNITS.find((u) => u.toLowerCase() === trimmedUnit.toLowerCase());
    if (!matchedUnit) {
      return NextResponse.json(
        { error: `Invalid packaging unit. Allowed values: ${ALLOWED_PRODUCT_UNITS.join(', ')}` },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';

    const product = await createProduct({
      prodCode: trimmedCode,
      description: trimmedDesc,
      unit: matchedUnit,
      actor,
    });

    return NextResponse.json(
      { message: 'Product created successfully', product, ...product },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/products] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create product' },
      { status: err.status || 500 }
    );
  }
}
