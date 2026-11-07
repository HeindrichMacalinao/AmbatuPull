'use strict';

const dbPool = require('../db/pool');

const ALL_36_RIGHTS = [
  'customer.add', 'customer.edit', 'customer.delete',
  'product.add', 'product.edit', 'product.delete',
  'price.add', 'price.edit', 'price.delete',
  'job.add', 'job.edit', 'job.delete',
  'dept.add', 'dept.edit', 'dept.delete',
  'emp.add', 'emp.edit', 'emp.delete',
  'jobhistory.view', 'jobhistory.add', 'jobhistory.edit', 'jobhistory.delete',
  'sale.add', 'sale.edit', 'sale.delete',
  'saledetail.view', 'saledetail.add', 'saledetail.edit', 'saledetail.delete',
  'report.top_customers', 'report.product_master', 'report.top_products',
  'report.active_emp', 'report.all_emp', 'report.emp_job_history', 'report.top_sales',
];

const MODULE_DEFINITIONS = {
  customer: { code: 'customers', name: 'Customers', path: '/customers' },
  product: { code: 'products', name: 'Products', path: '/products' },
  human_resources: { code: 'hr', name: 'HR', path: '/hr' },
  sales: { code: 'sales', name: 'Sales', path: '/sales' },
  reports: { code: 'reports', name: 'Reports', path: '/reports' },
  user_management: { code: 'user_management', name: 'User Management', path: '/users' },
  system_settings: { code: 'system_settings', name: 'System Settings', path: '/settings' },
};

/**
 * Resolve which module a rightCode belongs to.
 */
function resolveModuleCode(rightCode) {
  const code = String(rightCode).toLowerCase();
  if (code.startsWith('customer.')) return 'customer';
  if (code.startsWith('product.') || code.startsWith('price.')) return 'product';
  if (
    code.startsWith('hr.') ||
    code.startsWith('job.') ||
    code.startsWith('dept.') ||
    code.startsWith('emp.') ||
    code.startsWith('jobhistory.')
  ) {
    return 'human_resources';
  }
  if (code.startsWith('sale.') || code.startsWith('sales.') || code.startsWith('saledetail.')) {
    return 'sales';
  }
  if (code.startsWith('report.') || code.startsWith('reports.')) {
    return 'reports';
  }
  return null;
}

/**
 * GET /api/navigation (§1.2, §3.2, §4.2, S1-DEV-08).
 * - Superadmin: Customers, Products, HR, Sales, Reports, User Management, System Settings.
 * - Admin: Customers, Products, HR, Sales, Reports, User Management.
 * - User: Only modules where user has at least one active right.
 */
async function getNavigation({ user }) {
  if (!user || !user.role) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const role = user.role;

  if (role === 'Superadmin') {
    const menuItems = [
      'Customers',
      'Products',
      'HR',
      'Sales',
      'Reports',
      'User Management',
      'System Settings',
    ];
    const modules = [
      MODULE_DEFINITIONS.customer,
      MODULE_DEFINITIONS.product,
      MODULE_DEFINITIONS.human_resources,
      MODULE_DEFINITIONS.sales,
      MODULE_DEFINITIONS.reports,
      MODULE_DEFINITIONS.user_management,
      MODULE_DEFINITIONS.system_settings,
    ];

    return {
      role,
      menuItems,
      modules,
      navigation: menuItems,
      permittedActions: ALL_36_RIGHTS,
    };
  }

  if (role === 'Admin') {
    const menuItems = [
      'Customers',
      'Products',
      'HR',
      'Sales',
      'Reports',
      'User Management',
    ];
    const modules = [
      MODULE_DEFINITIONS.customer,
      MODULE_DEFINITIONS.product,
      MODULE_DEFINITIONS.human_resources,
      MODULE_DEFINITIONS.sales,
      MODULE_DEFINITIONS.reports,
      MODULE_DEFINITIONS.user_management,
    ];

    return {
      role,
      menuItems,
      modules,
      navigation: menuItems,
      permittedActions: ALL_36_RIGHTS,
    };
  }

  // Standard User: lookup active permissions
  const pool = dbPool.getPool();
  const userId = user.userId ?? user.userid;
  const rightsRes = await pool.query(
    "SELECT rightCode FROM user_permission WHERE userId = $1 AND status = 'Active'",
    [userId]
  );

  const activeRights = (rightsRes.rows || []).map((r) => r.rightCode ?? r.rightcode);
  const activeModulesSet = new Set();

  for (const rightCode of activeRights) {
    const mod = resolveModuleCode(rightCode);
    if (mod) {
      activeModulesSet.add(mod);
    }
  }

  // Ordered business modules to display if active
  const candidateModules = ['customer', 'product', 'human_resources', 'sales', 'reports'];
  const menuItems = [];
  const modules = [];

  for (const modKey of candidateModules) {
    if (activeModulesSet.has(modKey)) {
      const def = MODULE_DEFINITIONS[modKey];
      menuItems.push(def.name);
      modules.push(def);
    }
  }

  return {
    role,
    menuItems,
    modules,
    navigation: menuItems,
    permittedActions: activeRights,
  };
}

/**
 * GET /api/dashboard/metrics (§1.2, §3.2, S1-DEV-08).
 * Summary KPI counts calculated live from database:
 * - SELECT COUNT(*) FROM CUSTOMER WHERE status = 'Active'
 * - SELECT COUNT(*) FROM PRODUCT WHERE status = 'Active'
 * - SELECT COUNT(*) FROM SALES WHERE status = 'Active'
 * - Total revenue from active sales.
 */
async function getDashboardMetrics() {
  const pool = dbPool.getPool();

  const [custRes, prodRes, salesRes] = await Promise.all([
    pool.query("SELECT COUNT(*) AS count FROM CUSTOMER WHERE status = 'Active'"),
    pool.query("SELECT COUNT(*) AS count FROM PRODUCT WHERE status = 'Active'"),
    pool.query("SELECT COUNT(*) AS count FROM SALES WHERE status = 'Active'"),
  ]);

  const totalCustomers = Number(custRes.rows[0]?.count ?? custRes.rows[0]?.COUNT ?? 0);
  const totalProducts = Number(prodRes.rows[0]?.count ?? prodRes.rows[0]?.COUNT ?? 0);
  const totalSales = Number(salesRes.rows[0]?.count ?? salesRes.rows[0]?.COUNT ?? 0);

  let totalRevenue = 0;
  try {
    const revRes = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS revenue
       FROM PAYMENT p
       JOIN SALES s ON p.transNo = s.transNo
       WHERE s.status = 'Active' AND p.status = 'Active'`
    );
    totalRevenue = parseFloat(revRes.rows[0]?.revenue ?? revRes.rows[0]?.REVENUE ?? 0);
  } catch {
    try {
      const revRes = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) AS revenue FROM PAYMENT WHERE status = 'Active'"
      );
      totalRevenue = parseFloat(revRes.rows[0]?.revenue ?? revRes.rows[0]?.REVENUE ?? 0);
    } catch {
      totalRevenue = 0;
    }
  }

  const metrics = {
    totalCustomers,
    totalProducts,
    totalSales,
    totalRevenue,
    customers: totalCustomers,
    products: totalProducts,
    sales: totalSales,
    revenue: totalRevenue,
  };

  return {
    metrics,
    ...metrics,
  };
}

module.exports = {
  getNavigation,
  getDashboardMetrics,
  resolveModuleCode,
};
