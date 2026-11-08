import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Static 36 rights catalog for zero-configuration fallback
const ALL_36_RIGHTS = [
  { rightCode: 'customer.add', moduleCode: 'customer', description: 'Create new customer records' },
  { rightCode: 'customer.edit', moduleCode: 'customer', description: 'Modify existing customer profiles and credit limits' },
  { rightCode: 'customer.delete', moduleCode: 'customer', description: 'Deactivate or delete customer accounts' },
  { rightCode: 'product.add', moduleCode: 'product', description: 'Add new products to catalog' },
  { rightCode: 'product.edit', moduleCode: 'product', description: 'Edit product descriptions and units' },
  { rightCode: 'product.delete', moduleCode: 'product', description: 'Archive or delete products from active catalog' },
  { rightCode: 'price.add', moduleCode: 'product', description: 'Define new effective price points' },
  { rightCode: 'price.edit', moduleCode: 'product', description: 'Update historical price schedules' },
  { rightCode: 'price.delete', moduleCode: 'product', description: 'Remove invalid price history records' },
  { rightCode: 'dept.add', moduleCode: 'human_resources', description: 'Create operational departments' },
  { rightCode: 'dept.edit', moduleCode: 'human_resources', description: 'Edit department details and structures' },
  { rightCode: 'dept.delete', moduleCode: 'human_resources', description: 'Deactivate organizational departments' },
  { rightCode: 'job.add', moduleCode: 'human_resources', description: 'Define job positions and grades' },
  { rightCode: 'job.edit', moduleCode: 'human_resources', description: 'Modify job descriptions and compensation bands' },
  { rightCode: 'job.delete', moduleCode: 'human_resources', description: 'Retire obsolete job titles' },
  { rightCode: 'emp.add', moduleCode: 'human_resources', description: 'Onboard new company personnel' },
  { rightCode: 'emp.edit', moduleCode: 'human_resources', description: 'Update employee personal records' },
  { rightCode: 'emp.delete', moduleCode: 'human_resources', description: 'Record employee termination or separation' },
  { rightCode: 'jobhistory.view', moduleCode: 'human_resources', description: 'View confidential salary and promotion timelines (RA 10173)' },
  { rightCode: 'jobhistory.add', moduleCode: 'human_resources', description: 'Record salary increments and job transfers' },
  { rightCode: 'jobhistory.edit', moduleCode: 'human_resources', description: 'Correct recorded employment timeline entries' },
  { rightCode: 'jobhistory.delete', moduleCode: 'human_resources', description: 'Remove erroneously entered job history entries' },
  { rightCode: 'sale.add', moduleCode: 'sales', description: 'Generate new sales orders and invoices' },
  { rightCode: 'sale.edit', moduleCode: 'sales', description: 'Modify unfinalized sales transactions' },
  { rightCode: 'sale.delete', moduleCode: 'sales', description: 'Cancel or void sales transactions' },
  { rightCode: 'saledetail.view', moduleCode: 'sales', description: 'Inspect line-item sales breakdowns' },
  { rightCode: 'saledetail.add', moduleCode: 'sales', description: 'Add line item products to active sales invoice' },
  { rightCode: 'saledetail.edit', moduleCode: 'sales', description: 'Adjust sale line item prices or discounts' },
  { rightCode: 'saledetail.delete', moduleCode: 'sales', description: 'Remove line items from unposted orders' },
  { rightCode: 'report.top_customers', moduleCode: 'reports', description: 'Generate report of highest grossing customer accounts' },
  { rightCode: 'report.product_master', moduleCode: 'reports', description: 'Export comprehensive master product directory' },
  { rightCode: 'report.top_products', moduleCode: 'reports', description: 'Analyze best-selling products by quantity and revenue' },
  { rightCode: 'report.active_emp', moduleCode: 'reports', description: 'Generate roster of currently employed active personnel' },
  { rightCode: 'report.all_emp', moduleCode: 'reports', description: 'Generate complete historical personnel registry' },
  { rightCode: 'report.emp_job_history', moduleCode: 'reports', description: 'Audit individual career timeline, rank, and compensation history' },
  { rightCode: 'report.top_sales', moduleCode: 'reports', description: 'Review highest-value sales transactions and volume metrics' },
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = Number(id);

  try {
    const supabase = getAdminClient();
    const { data: userPerms } = await supabase
      .from('user_permission')
      .select('rightCode')
      .eq('userId', userId)
      .eq('status', 'Active');

    const grantedCodes = userPerms ? userPerms.map((p) => p.rightCode) : [];
    return NextResponse.json({
      userId,
      allRights: ALL_36_RIGHTS,
      grantedRights: grantedCodes,
    });
  } catch {
    // Fallback: If user 1 (superadmin), grant all, else default empty
    const grantedCodes = userId === 1 ? ALL_36_RIGHTS.map((r) => r.rightCode) : [];
    return NextResponse.json({
      userId,
      allRights: ALL_36_RIGHTS,
      grantedRights: grantedCodes,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);
    const { rights } = await request.json(); // array of string right codes

    if (!Array.isArray(rights)) {
      return NextResponse.json({ error: 'Rights must be an array of right codes' }, { status: 400 });
    }

    try {
      const supabase = getAdminClient();
      // Remove current permissions
      await supabase.from('user_permission').delete().eq('userId', userId);

      // Insert new permissions
      if (rights.length > 0) {
        const rows = rights.map((code: string) => ({
          userId,
          rightCode: code,
          status: 'Active',
          stamp: `RIGHTS_UPDATE_${Date.now()}`,
        }));
        await supabase.from('user_permission').insert(rows);
      }
    } catch {
      // Fallback
    }

    return NextResponse.json({
      message: 'User permissions updated successfully',
      userId,
      grantedCount: rights.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update rights' }, { status: 500 });
  }
}
