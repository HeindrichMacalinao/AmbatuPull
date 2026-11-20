import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/erp-db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ prodCode: string; effDate: string }> }
) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore prices' },
        { status: 403 }
      );
    }

    const { prodCode, effDate } = await params;
    const db = getSqliteDb();
    const existing = db.prepare('SELECT status, unitPrice FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate) as any;
    if (!existing) {
      return NextResponse.json({ error: 'Price record not found' }, { status: 404 });
    }
    if (existing.status === 'Active') {
      return NextResponse.json({ error: 'Price record is already active' }, { status: 400 });
    }

    const actor = request.headers.get('x-user-email') || role || 'system';
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const stamp = `RESTORED ${actor} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(hours)}:${pad(now.getMinutes())} ${ampm}`;

    db.prepare("UPDATE PRICEHIST SET status = 'Active', stamp = ? WHERE prodCode = ? AND effDate = ?").run(stamp, prodCode, effDate);
    const updated = db.prepare('SELECT prodCode, effDate, unitPrice, status, stamp FROM PRICEHIST WHERE prodCode = ? AND effDate = ?').get(prodCode, effDate) as any;

    return NextResponse.json({
      message: 'Price record restored successfully',
      price: { ...updated, unitPrice: Number(updated.unitPrice) },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to restore price record' },
      { status: err.status || 500 }
    );
  }
}
