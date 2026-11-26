import { NextResponse } from 'next/server';
import { restoreJob } from '@/lib/erp-db';

async function handleRestore(
  request: Request,
  { params }: { params: Promise<{ jobCode: string }> }
) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'Admin' && role !== 'Superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: only Admin or Superadmin can restore jobs' },
        { status: 403 }
      );
    }

    const { jobCode } = await params;
    const actor = request.headers.get('x-user-email') || role || 'system';
    const job = await restoreJob({ jobCode, actor });

    return NextResponse.json({
      message: 'Job restored successfully',
      job,
      ...job,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to restore job' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobCode: string }> }
) {
  return handleRestore(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ jobCode: string }> }
) {
  return handleRestore(request, context);
}
