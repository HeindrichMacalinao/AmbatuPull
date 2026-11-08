import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/erp-db';

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (err: any) {
    console.error('[API GET /api/dashboard/metrics] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
