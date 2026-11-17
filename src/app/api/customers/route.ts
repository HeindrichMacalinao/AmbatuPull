import { NextResponse } from 'next/server';
import { getCustomers, createCustomer } from '@/lib/erp-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    // Check auth header if provided (e.g. x-user-role)
    const role = request.headers.get('x-user-role') || 'User';

    const customers = await getCustomers({ search, status, role });
    return NextResponse.json({ customers, total: customers.length });
  } catch (err: any) {
    console.error('[API GET /api/customers] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve customers' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { custNo, custName, address, payTerms } = body;

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';

    const newCust = await createCustomer({
      custNo,
      custName,
      address,
      payTerms,
      actor,
    });

    return NextResponse.json(
      { message: 'Customer created successfully', customer: newCust },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/customers] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create customer' },
      { status: err.status || 500 }
    );
  }
}
