import { NextResponse } from 'next/server';
import { updateJob, softDeleteJob, getUserGrantedRights } from '@/lib/erp-db';

async function assertJobRight(request: Request, rightCode: 'job.edit' | 'job.delete') {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;

  if (role !== 'User') {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw Object.assign(new Error('Unauthorized: user identity is required'), { status: 401 });
  }

  const rights = await getUserGrantedRights(userId);
  if (!rights.includes(rightCode) && !rights.includes('*')) {
    throw Object.assign(new Error(`Forbidden: missing required permission '${rightCode}'`), { status: 403 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ jobCode: string }> }
) {
  try {
    await assertJobRight(request, 'job.edit');
    const { jobCode } = await params;
    const body = await request.json();
    const jobDesc = typeof body.jobDesc === 'string' ? body.jobDesc.trim() : '';

    if (!jobDesc) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }
    if (jobDesc.length > 100) {
      return NextResponse.json(
        { error: 'Job description must not exceed 100 characters' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const job = await updateJob({ jobCode, jobDesc, actor });

    return NextResponse.json({ message: 'Job updated successfully', job, ...job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update job' },
      { status: err.status || 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobCode: string }> }
) {
  try {
    await assertJobRight(request, 'job.delete');
    const { jobCode } = await params;
    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const job = await softDeleteJob({ jobCode, actor });

    return NextResponse.json({ message: 'Job deleted successfully', job, ...job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete job' },
      { status: err.status || 500 }
    );
  }
}
