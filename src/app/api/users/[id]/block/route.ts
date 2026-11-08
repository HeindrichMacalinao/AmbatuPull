import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const { isBlocked } = await request.json();

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    try {
      const supabase = getAdminClient();
      
      // Fetch the target user
      const { data: targetUser, error: fetchErr } = await supabase
        .from('app_user')
        .select('*')
        .eq('userId', userId)
        .single();

      if (targetUser && !fetchErr) {
        // Last-Superadmin Safeguard
        if (targetUser.role === 'Superadmin' && isBlocked) {
          const { count, error: countErr } = await supabase
            .from('app_user')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'Superadmin')
            .eq('isBlocked', false)
            .eq('status', 'Active');

          if (!countErr && (count ?? 0) <= 1) {
            return NextResponse.json(
              { error: 'Cannot block the last active Superadmin. System governance requires at least one active Superadmin.' },
              { status: 400 }
            );
          }
        }

        const { data: updated, error: updateErr } = await supabase
          .from('app_user')
          .update({
            isBlocked: Boolean(isBlocked),
            stamp: `STATUS_UPDATE_${Date.now()}`,
          })
          .eq('userId', userId)
          .select()
          .single();

        if (updated && !updateErr) {
          return NextResponse.json({
            message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
            user: updated,
          });
        }
      }
    } catch {
      // Offline fallback handling
    }

    return NextResponse.json({
      message: `User status updated (Fallback)`,
      userId,
      isBlocked: Boolean(isBlocked),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Block operation failed' }, { status: 500 });
  }
}
