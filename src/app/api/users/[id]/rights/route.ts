import { NextResponse } from 'next/server';
import { ALL_36_RIGHTS, getUserGrantedRights, setUserRights } from '@/lib/erp-db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const grantedRights = await getUserGrantedRights(userId);

    return NextResponse.json({
      userId,
      allRights: ALL_36_RIGHTS,
      grantedRights,
    });
  } catch (err: any) {
    console.error('[API GET /api/users/:id/rights] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve rights' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const { rights } = await request.json();

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (!Array.isArray(rights)) {
      return NextResponse.json({ error: 'Rights must be an array of right codes' }, { status: 400 });
    }

    const savedRights = await setUserRights(userId, rights, 'admin');

    return NextResponse.json({
      message: 'User permissions updated successfully',
      userId,
      grantedRights: savedRights,
    });
  } catch (err: any) {
    console.error('[API POST /api/users/:id/rights] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update user rights' },
      { status: err.status || 500 }
    );
  }
}
