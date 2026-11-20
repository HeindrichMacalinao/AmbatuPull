import { NextResponse } from 'next/server';
import { getSqliteDb, getUserGrantedRights } from '@/lib/erp-db';

async function assertPriceRight(request: Request, rightCode: 'price.edit' | 'price.delete') {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;
  if (role !== 'User') throw Object.assign(new Error('Forbidden'), { status: 403 });
  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) throw Object.assign(new Error('Unauthorized: user identity is required'), { status: 401 });
  const rights = await getUserGrantedRights(userId);
  if (!rights.includes(rightCode) && !rights.includes('*')) throw Object.assign(new Error(`Forbidden: missing required permission '${rightCode}'`), { status: 403 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ prodCode: string; effDate: string }> }
) {
  try {
    await assertPriceRight(request, 'price.edit');
    const { prodCode, effDate } = await params;
    const body = await request.json();
    const unitPrice = Number(body.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return NextResponse.json({ error: 'Unit price must be greater than zero.' }, { status: 400 });
    const db = getSqliteDb();
    const existing = db.prepare('SELECT 1 FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate);
    if (!existing) return NextResponse.json({ error: 'Price record not found' }, { status: 404 });
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const stamp = `EDITED ${actor} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    db.prepare('UPDATE PRICEHIST SET unitPrice = ?, stamp = ? WHERE prodCode = ? AND effDate = ?').run(unitPrice, stamp, prodCode, effDate);
    const price = db.prepare('SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate) as any;
    return NextResponse.json({ message: 'Price record updated successfully', price: { ...price, unitPrice: Number(price.unitPrice) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update price record' }, { status: err.status || 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ prodCode: string; effDate: string }> }
) {
  try {
    await assertPriceRight(request, 'price.delete');
    const { prodCode, effDate } = await params;
    const db = getSqliteDb();
    const existing = db.prepare('SELECT 1 FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate);
    if (!existing) return NextResponse.json({ error: 'Price record not found' }, { status: 404 });
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const stamp = `DELETED ${actor} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    db.prepare("UPDATE PRICEHIST SET status = 'Inactive', stamp = ? WHERE prodCode = ? AND effDate = ?").run(stamp, prodCode, effDate);
    return NextResponse.json({ message: 'Price record deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete price record' }, { status: err.status || 500 });
  }
}
