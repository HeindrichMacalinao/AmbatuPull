import { NextResponse } from 'next/server';
import { updateCustomer, softDeleteCustomer, getSqliteDb } from '@/lib/erp-db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custNo: string }> }
) {
  try {
    const { custNo } = await params;
    const db = getSqliteDb();
    const customer = db.prepare('SELECT * FROM CUSTOMER WHERE custNo = ?').get(custNo) as any;

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer, ...customer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve customer' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ custNo: string }> }
) {
  try {
    const { custNo } = await params;
    const body = await request.json();
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';

    const updated = await updateCustomer({
      custNo,
      custName: body.custName,
      address: body.address,
      payTerms: body.payTerms,
      actor,
    });

    return NextResponse.json({
      message: 'Customer updated successfully',
      customer: updated,
      ...updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update customer' },
      { status: err.status || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ custNo: string }> }
) {
  try {
    const { custNo } = await params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';

    const deleted = await softDeleteCustomer({
      custNo,
      actor,
    });

    return NextResponse.json({
      message: 'Customer soft deleted successfully',
      customer: deleted,
      ...deleted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to soft delete customer' },
      { status: err.status || 500 }
    );
  }
}
