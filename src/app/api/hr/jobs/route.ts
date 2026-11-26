import { NextResponse } from 'next/server';
import { getJobs, createJob, getUserGrantedRights } from '@/lib/erp-db';

async function assertJobRight(request: Request, rightCode: 'job.add' | 'job.edit' | 'job.delete') {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const role = request.headers.get('x-user-role') || 'User';

    const result = await getJobs({ search, status, role });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API GET /api/hr/jobs] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve jobs' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertJobRight(request, 'job.add');

    const body = await request.json();
    const jobCode = typeof body.jobCode === 'string' ? body.jobCode.trim() : '';
    const jobDesc = typeof body.jobDesc === 'string' ? body.jobDesc.trim() : '';

    if (!jobCode || !jobDesc) {
      return NextResponse.json(
        { error: 'Job code and job description are required' },
        { status: 400 }
      );
    }

    if (jobCode.length > 10) {
      return NextResponse.json(
        { error: 'Job code must not exceed 10 characters' },
        { status: 400 }
      );
    }

    if (jobDesc.length > 100) {
      return NextResponse.json(
        { error: 'Job description must not exceed 100 characters' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const job = await createJob({ jobCode, jobDesc, actor });

    return NextResponse.json(
      { message: 'Job created successfully', job, ...job },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/hr/jobs] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create job' },
      { status: err.status || 500 }
    );
  }
}
