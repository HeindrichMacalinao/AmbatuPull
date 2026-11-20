import { NextResponse } from 'next/server';
import { getSqliteDb, getUserGrantedRights } from '@/lib/erp-db';

async function assertPriceMutation(request: Request, rightCode: 'price.add' | 'price.edit' | 'price.delete') {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;
  if (role !== 'User') throw Object.assign(new Error('Forbidden'), { status: 403 });
  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) throw Object.assign(new Error('Unauthorized: user identity is required'), { status: 401 });
  const rights = await getUserGrantedRights(userId);
  if (!rights.includes(rightCode) && !rights.includes('*')) {
    throw Object.assign(new Error(`Forbidden: missing required permission '${rightCode}'`), { status: 403 });
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
    const isAdmin = role === 'Admin' || role === 'Superadmin';
    const status = new URL(request.url).searchParams.get('status');
    let query = 'SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST WHERE prodCode = ?';
    const queryParams: Array<string> = [prodCode];
    if (!isAdmin) {
      query += " AND status = 'Active'";
    } else if (status && ['Active', 'Inactive'].includes(status)) {
      query += ' AND status = ?';
      queryParams.push(status);
    }
    query += ' ORDER BY effDate DESC';
    const rows = db.prepare(query).all(...queryParams) as Array<{ prodCode: string; effDate: string; unitPrice: number; status: string; stamp: string }>;
    return NextResponse.json({ prices: rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice) })) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve price history' }, { status: err.status || 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ prodCode: string }> }
) {
  try {
    await assertPriceMutation(request, 'price.add');
    const { prodCode } = await params;
    const body = await request.json();
    const effDate = typeof body.effDate === 'string' ? body.effDate.trim() : '';
    const unitPrice = Number(body.unitPrice);
    if (!effDate) return NextResponse.json({ error: 'Effective date is required.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effDate)) return NextResponse.json({ error: 'Effective date is invalid.' }, { status: 400 });
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return NextResponse.json({ error: 'Unit price must be greater than zero.' }, { status: 400 });

    const db = getSqliteDb();
    const duplicate = db.prepare('SELECT 1 FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate);
    if (duplicate) return NextResponse.json({ error: 'A price record already exists for this effective date.' }, { status: 409 });
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const stamp = `CREATED ${actor} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    db.prepare("INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp) VALUES (?, ?, ?, 'Active', ?)").run(prodCode, effDate, unitPrice, stamp);
    const price = db.prepare('SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate) as any;
    return NextResponse.json({ message: 'Price record created successfully', price: { ...price, unitPrice: Number(price.unitPrice) } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create price record' }, { status: err.status || 500 });
  }
}
