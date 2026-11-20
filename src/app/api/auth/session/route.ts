import { NextResponse } from 'next/server';
import { getUserGrantedRights } from '@/lib/erp-db';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role');
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized: authentication required' }, { status: 401 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const email = request.headers.get('x-user-email') || '';
  let rights: string[] = [];

  if (role === 'Admin' || role === 'Superadmin') {
    rights = ['*'];
  } else if (userId > 0) {
    rights = await getUserGrantedRights(userId);
  }

  return NextResponse.json({
    user: { userId, email, role, rights },
    role,
    rights,
  });
}
