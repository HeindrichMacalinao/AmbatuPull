import { NextResponse } from 'next/server';
import { updateCustomer, softDeleteCustomer, getSqliteDb, getUserGrantedRights } from '@/lib/erp-db';

async function assertMutationRight(request: Request, rightCode: 'customer.edit' | 'customer.delete') {
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
  if (!rights.includes(rightCode) && !rights.includes('*')) {
    const error = new Error(`Forbidden: missing required permission '${rightCode}'`);
    (error as any).status = 403;
    throw error;
  }
}

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
    await assertMutationRight(request, 'customer.edit');
    const { custNo } = await params;
    const body = await request.json();
    if (!body.custName?.trim() || !body.address?.trim() || !body.payTerms) {
      return NextResponse.json(
        { error: 'Customer name, billing address, and payment terms are required' },
        { status: 400 }
      );
    }
    const allowedPayTerms = ['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid'];
    if (!allowedPayTerms.includes(body.payTerms)) {
      return NextResponse.json(
        { error: `Invalid payment terms. Allowed values: ${allowedPayTerms.join(', ')}` },
        { status: 400 }
      );
    }
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
    await assertMutationRight(request, 'customer.delete');
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
