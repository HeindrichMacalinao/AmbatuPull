import { NextResponse } from 'next/server';
import { updateProduct, softDeleteProduct, restoreProduct, getSqliteDb } from '@/lib/erp-db';

async function assertEditProductRight(request: Request) {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;
  throw Object.assign(new Error('Forbidden'), { status: 403 });
}

async function assertDeleteProductRight(request: Request) {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;
  throw Object.assign(new Error('Forbidden'), { status: 403 });
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
      const allowedUnits = ['pcs', 'can', 'pair', 'meter', 'roll', 'box', 'kg'];
      const matchedUnit = allowedUnits.find((u) => u.toLowerCase() === trimmedUnit.toLowerCase());
      if (!matchedUnit) {
        return NextResponse.json(
          { error: `Invalid packaging unit. Allowed values: ${allowedUnits.join(', ')}` },
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
