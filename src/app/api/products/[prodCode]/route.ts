import { NextResponse } from 'next/server';
import { updateProduct, softDeleteProduct, restoreProduct, getSqliteDb, getUserGrantedRights, ALLOWED_PRODUCT_UNITS } from '@/lib/erp-db';

async function assertEditProductRight(request: Request) {
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
  if (!rights.includes('product.edit') && !rights.includes('*')) {
    const error = new Error("Forbidden: missing required permission 'product.edit'");
    (error as any).status = 403;
    throw error;
  }
}

async function assertDeleteProductRight(request: Request) {
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
  if (!rights.includes('product.delete') && !rights.includes('*')) {
    const error = new Error("Forbidden: missing required permission 'product.delete'");
    (error as any).status = 403;
    throw error;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ prodCode: string }> }
) {
  try {
    const { prodCode } = await params;
    const db = getSqliteDb();
    const role = request.headers.get('x-user-role') || 'User';
    const isUser = role !== 'Admin' && role !== 'Superadmin';

    const row = db.prepare(`
      SELECT p.prodCode, p.description, p.unit, p.status, p.stamp,
             (SELECT ph.unitPrice
              FROM PRICEHIST ph
              WHERE ph.prodCode = p.prodCode
                AND ph.effDate <= CURRENT_DATE
                AND ph.status = 'Active'
              ORDER BY ph.effDate DESC
              LIMIT 1) AS currentPrice
      FROM PRODUCT p
      WHERE p.prodCode = ?
    `).get(prodCode) as any;

    if (!row) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (isUser && row.status === 'Inactive') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const currentPrice = row.currentPrice != null ? Number(row.currentPrice) : null;
    const product = isUser
      ? {
          prodCode: row.prodCode,
          description: row.description,
          unit: row.unit ?? null,
          currentPrice,
        }
      : {
          prodCode: row.prodCode,
          description: row.description,
          unit: row.unit ?? null,
          currentPrice,
          status: row.status,
          stamp: row.stamp,
        };

    return NextResponse.json({ product, ...product });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ prodCode: string }> }
) {
  try {
    await assertEditProductRight(request);
    const { prodCode } = await params;
    const body = await request.json();

    let description: string | undefined = undefined;
    if (body.description !== undefined) {
      const trimmedDesc = String(body.description).trim();
      if (!trimmedDesc || trimmedDesc.length > 100) {
        return NextResponse.json(
          { error: 'Description is required and must not exceed 100 characters' },
          { status: 400 }
        );
      }
      description = trimmedDesc;
    }

    let unit: string | undefined = undefined;
    if (body.unit !== undefined) {
      const trimmedUnit = String(body.unit).trim();
      const matchedUnit = ALLOWED_PRODUCT_UNITS.find((u) => u.toLowerCase() === trimmedUnit.toLowerCase());
      if (!matchedUnit) {
        return NextResponse.json(
          { error: `Invalid packaging unit. Allowed values: ${ALLOWED_PRODUCT_UNITS.join(', ')}` },
          { status: 400 }
        );
      }
      unit = matchedUnit;
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';

    const updated = await updateProduct({
      prodCode,
      description,
      unit,
      actor,
    });

    return NextResponse.json({
      message: 'Product updated successfully',
      product: updated,
      ...updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update product' },
      { status: err.status || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ prodCode: string }> }
) {
  try {
    await assertDeleteProductRight(request);
    const { prodCode } = await params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const deleted = await softDeleteProduct({ prodCode, actor });
    return NextResponse.json({ message: 'Product deleted successfully', product: deleted, ...deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete product' }, { status: err.status || 500 });
  }
}
