import { NextResponse } from 'next/server';
import { getEmployees } from '@/lib/erp-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const role = request.headers.get('x-user-role') || 'User';

    const result = await getEmployees({ search, status, role });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API GET /api/hr/employees] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve employees' },
      { status: err.status || 500 }
    );
  }
}
