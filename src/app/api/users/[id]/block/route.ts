import { NextResponse } from 'next/server';
import { toggleUserBlock } from '@/lib/erp-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const { isBlocked } = await request.json();

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID parameter' }, { status: 400 });
    }

    const updatedUser = await toggleUserBlock(userId, Boolean(isBlocked), 'admin');

    return NextResponse.json({
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('[API POST /api/users/:id/block] error:', err);
    return NextResponse.json(
      { error: err.message || 'Block/Unblock operation failed' },
      { status: err.status || 500 }
    );
  }
}
