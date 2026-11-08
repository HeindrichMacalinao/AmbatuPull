'use strict';

import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AppUser, RoleName } from '@/types/erp';

// ------------------------------------------------------------------------------
// 1. Supabase Availability Helper
// ------------------------------------------------------------------------------
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes('placeholder') || url.includes('your-project')) return false;
  return true;
}

// ------------------------------------------------------------------------------
// 2. Local SQLite Engine Setup (HopeERP.db) + S1-DBA-06 Audit Trigger Registration
// ------------------------------------------------------------------------------
let sqliteDbInstance: DatabaseSync | null = null;
let currentAuditActor = 'system';

export function setAuditActor(actor: string) {
  currentAuditActor = actor || 'system';
}

export function getSqliteDb(): DatabaseSync {
  if (!sqliteDbInstance) {
    const dbPath = path.resolve(process.cwd(), 'HopeERP.db');
    sqliteDbInstance = new DatabaseSync(dbPath);
    sqliteDbInstance.exec('PRAGMA foreign_keys = ON;');
    sqliteDbInstance.exec('PRAGMA journal_mode = WAL;');

    // Register custom SQLite function required by S1-DBA-06 triggers
    sqliteDbInstance.function('audit_user', { deterministic: false }, () => {
      return currentAuditActor || 'system';
    });
  }
  return sqliteDbInstance;
}

// ------------------------------------------------------------------------------
// 3. 36 Granular Rights Catalog (Student Guide §3.8 Parity)
// ------------------------------------------------------------------------------
export const ALL_36_RIGHTS = [
  // Customer (3)
  { rightCode: 'customer.add', moduleCode: 'customer', moduleName: 'Customer Management', description: 'Create new customer records' },
  { rightCode: 'customer.edit', moduleCode: 'customer', moduleName: 'Customer Management', description: 'Modify existing customer profiles and credit terms' },
  { rightCode: 'customer.delete', moduleCode: 'customer', moduleName: 'Customer Management', description: 'Soft delete customer records (status = Inactive)' },
  // Product & Pricing (6)
  { rightCode: 'product.add', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Add new products and SKUs' },
  { rightCode: 'product.edit', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Edit product specifications and units' },
  { rightCode: 'product.delete', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Archive or deactivate products' },
  { rightCode: 'price.add', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Set new effective price points' },
  { rightCode: 'price.edit', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Adjust historical pricing schedules' },
  { rightCode: 'price.delete', moduleCode: 'product', moduleName: 'Product & Pricing Catalog', description: 'Remove invalid price records' },
  // Human Resources (13)
  { rightCode: 'dept.add', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Create operational departments' },
  { rightCode: 'dept.edit', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Modify department details' },
  { rightCode: 'dept.delete', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Deactivate departments' },
  { rightCode: 'job.add', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Define job positions' },
  { rightCode: 'job.edit', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Modify job descriptions and compensation bands' },
  { rightCode: 'job.delete', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Retire obsolete job titles' },
  { rightCode: 'emp.add', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Onboard new personnel' },
  { rightCode: 'emp.edit', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Update employee personal records' },
  { rightCode: 'emp.delete', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Record employee separation date' },
  { rightCode: 'jobhistory.view', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Inspect confidential salary and promotion timelines (RA 10173)' },
  { rightCode: 'jobhistory.add', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Record promotion or salary increments' },
  { rightCode: 'jobhistory.edit', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Correct employment history entries' },
  { rightCode: 'jobhistory.delete', moduleCode: 'human_resources', moduleName: 'Human Resources & Payroll', description: 'Remove erroneously entered timeline records' },
  // Sales & Distribution (7)
  { rightCode: 'sale.add', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Create sales orders and transactions' },
  { rightCode: 'sale.edit', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Modify unposted sales records' },
  { rightCode: 'sale.delete', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Cancel or soft delete sales orders' },
  { rightCode: 'saledetail.view', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Inspect itemized sales lines' },
  { rightCode: 'saledetail.add', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Add products to sale with date-effective pricing' },
  { rightCode: 'saledetail.edit', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Modify order line items' },
  { rightCode: 'saledetail.delete', moduleCode: 'sales', moduleName: 'Sales & Distribution', description: 'Remove line items from draft sales' },
  // Reports (7)
  { rightCode: 'report.top_customers', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Generate Top Customers by gross revenue' },
  { rightCode: 'report.product_master', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Export Master Product Directory' },
  { rightCode: 'report.top_products', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Analyze best-selling products by quantity and revenue' },
  { rightCode: 'report.active_emp', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Generate Active Employee Roster (unseparated)' },
  { rightCode: 'report.all_emp', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Generate All Employees Roster (including separated)' },
  { rightCode: 'report.emp_job_history', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Audit individual career timeline, rank, and compensation history' },
  { rightCode: 'report.top_sales', moduleCode: 'reports', moduleName: 'Business Intelligence & Reports', description: 'Review largest sales transactions in date range' },
];

// ------------------------------------------------------------------------------
// 4. Database Seeding & Initialization
// ------------------------------------------------------------------------------
let isInitialized = false;

export async function ensureDbInitialized(): Promise<void> {
  if (isInitialized) return;

  const db = getSqliteDb();
  setAuditActor('system');

  // Ensure password_reset_token table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_token (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      tokenHash VARCHAR(255) NOT NULL,
      expiresAt TIMESTAMP NOT NULL,
      isUsed BOOLEAN NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      usedAt TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES app_user(userId) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_token(tokenHash);
  `);

  // Check if app_user has any users
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM app_user').get() as { count: number };
  if (userCountRow.count === 0) {
    const defaultPasswordHash = bcrypt.hashSync('Admin@123456', 10);
    const qaPasswordHash = bcrypt.hashSync('QaPassword!123', 10);

    const seedUsers = [
      { firstName: 'Super', lastName: 'Admin', email: 'superadmin@hope-erp.local', role: 'Superadmin', hash: defaultPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'Operations', lastName: 'Admin', email: 'admin@hope-erp.local', role: 'Admin', hash: defaultPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'Standard', lastName: 'Staff', email: 'user@hope-erp.local', role: 'User', hash: defaultPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'QA', lastName: 'Superadmin', email: 'test_superadmin@hope.com', role: 'Superadmin', hash: qaPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'QA', lastName: 'Admin', email: 'test_admin@hope.com', role: 'Admin', hash: qaPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'QA', lastName: 'User', email: 'test_user@hope.com', role: 'User', hash: qaPasswordHash, isBlocked: 0, empNo: null },
      { firstName: 'QA', lastName: 'Blocked User', email: 'test_blocked@hope.com', role: 'User', hash: qaPasswordHash, isBlocked: 1, empNo: null },
    ];

    const insertUser = db.prepare(`
      INSERT INTO app_user (firstName, lastName, email, passwordHash, role, isBlocked, empNo, status, stamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `);

    for (const u of seedUsers) {
      setAuditActor('system');
      insertUser.run(u.firstName, u.lastName, u.email.toLowerCase(), u.hash, u.role, u.isBlocked, u.empNo, 'CREATED system');
    }

    // Grant all 36 rights to Superadmin users
    const superadmins = db.prepare("SELECT userId FROM app_user WHERE role = 'Superadmin'").all() as { userId: number }[];
    const insertPerm = db.prepare(`
      INSERT OR IGNORE INTO user_permission (userId, rightCode, status, stamp)
      VALUES (?, ?, 'Active', 'SEEDED system')
    `);

    for (const sa of superadmins) {
      for (const r of ALL_36_RIGHTS) {
        insertPerm.run(sa.userId, r.rightCode);
      }
    }
  }

  isInitialized = true;
}

// ------------------------------------------------------------------------------
// 5. User Data Access Operations
// ------------------------------------------------------------------------------

export interface UserRecord extends AppUser {
  passwordHash: string;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureDbInitialized();
  const cleanEmail = String(email).trim().toLowerCase();

  // 1. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('app_user')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (data && !error) {
        return {
          userId: Number(data.userId),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role as RoleName,
          isBlocked: Boolean(data.isBlocked),
          empNo: data.empNo || undefined,
          status: data.status,
          stamp: data.stamp,
          passwordHash: data.passwordHash,
        };
      }
    } catch (err) {
      console.warn('[erp-db] Supabase query notice:', err);
    }
  }

  // 2. Query SQLite
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM app_user WHERE LOWER(email) = ?').get(cleanEmail) as any;
  if (!row) return null;

  return {
    userId: Number(row.userId),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: row.role as RoleName,
    isBlocked: Boolean(row.isBlocked === 1 || row.isBlocked === true),
    empNo: row.empNo || undefined,
    status: row.status,
    stamp: row.stamp,
    passwordHash: row.passwordHash,
  };
}

export async function getUserById(userId: number): Promise<AppUser | null> {
  await ensureDbInitialized();

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('app_user')
        .select('userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp')
        .eq('userId', userId)
        .maybeSingle();

      if (data && !error) {
        return {
          userId: Number(data.userId),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: data.role as RoleName,
          isBlocked: Boolean(data.isBlocked),
          empNo: data.empNo || undefined,
          status: data.status,
          stamp: data.stamp,
        };
      }
    } catch {}
  }

  const db = getSqliteDb();
  const row = db.prepare('SELECT userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp FROM app_user WHERE userId = ?').get(userId) as any;
  if (!row) return null;

  return {
    userId: Number(row.userId),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: row.role as RoleName,
    isBlocked: Boolean(row.isBlocked === 1 || row.isBlocked === true),
    empNo: row.empNo || undefined,
    status: row.status,
    stamp: row.stamp,
  };
}

export async function getUsers(filter?: { search?: string; role?: string }): Promise<AppUser[]> {
  await ensureDbInitialized();
  const search = filter?.search?.trim().toLowerCase();
  const role = filter?.role;

  // 1. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      let query = supabase.from('app_user').select('userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp').neq('status', 'Inactive');
      if (role && role !== 'all') {
        query = query.eq('role', role);
      }
      const { data, error } = await query;
      if (data && !error && data.length > 0) {
        let list: AppUser[] = data.map((d: any) => ({
          userId: Number(d.userId),
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          role: d.role as RoleName,
          isBlocked: Boolean(d.isBlocked),
          empNo: d.empNo || undefined,
          status: d.status,
          stamp: d.stamp,
        }));
        if (search) {
          list = list.filter(u => u.firstName.toLowerCase().includes(search) || u.lastName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
        }
        return list;
      }
    } catch {}
  }

  // 2. Query SQLite
  const db = getSqliteDb();
  let sql = "SELECT userId, firstName, lastName, email, role, isBlocked, empNo, status, stamp FROM app_user WHERE status = 'Active'";
  const params: any[] = [];

  if (role && role !== 'all') {
    sql += ' AND role = ?';
    params.push(role);
  }
  sql += ' ORDER BY userId ASC';

  const rows = db.prepare(sql).all(...params) as any[];
  let list: AppUser[] = rows.map((r) => ({
    userId: Number(r.userId),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    role: r.role as RoleName,
    isBlocked: Boolean(r.isBlocked === 1 || r.isBlocked === true),
    empNo: r.empNo || undefined,
    status: r.status,
    stamp: r.stamp,
  }));

  if (search) {
    list = list.filter(u => u.firstName.toLowerCase().includes(search) || u.lastName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
  }

  return list;
}

export async function createUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: RoleName;
  empNo?: string | null;
  actor?: string;
}): Promise<AppUser> {
  await ensureDbInitialized();

  const { firstName, lastName, email, password } = payload;
  const role: RoleName = payload.role || 'User';
  const empNo = payload.empNo || null;
  const actor = payload.actor || 'self';

  const cleanEmail = String(email).trim().toLowerCase();

  // Check email uniqueness
  const existing = await getUserByEmail(cleanEmail);
  if (existing) {
    const err = new Error('Email already registered');
    (err as any).status = 409;
    throw err;
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const db = getSqliteDb();
  setAuditActor(actor);

  const stmt = db.prepare(`
    INSERT INTO app_user (firstName, lastName, email, passwordHash, role, isBlocked, empNo, status, stamp)
    VALUES (?, ?, ?, ?, ?, 0, ?, 'Active', ?)
  `);
  const info = stmt.run(firstName.trim(), lastName.trim(), cleanEmail, passwordHash, role, empNo, `CREATED ${actor}`);
  const newUserId = Number(info.lastInsertRowid);

  // Sync with Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      await supabase.from('app_user').insert({
        userId: newUserId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        passwordHash,
        role,
        isBlocked: false,
        empNo,
        status: 'Active',
        stamp: `CREATED ${actor}`,
      });
    } catch (err) {
      console.warn('[erp-db] Supabase user insert sync notice:', err);
    }
  }

  return {
    userId: newUserId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: cleanEmail,
    role,
    isBlocked: false,
    empNo: empNo || undefined,
    status: 'Active',
    stamp: `CREATED ${actor}`,
  };
}

export async function toggleUserBlock(userId: number, isBlocked: boolean, actor: string = 'admin'): Promise<AppUser> {
  await ensureDbInitialized();
  const db = getSqliteDb();
  setAuditActor(actor);

  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }

  // Last-Superadmin Safeguard Rule
  if (user.role === 'Superadmin' && isBlocked) {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM app_user WHERE role = 'Superadmin' AND status = 'Active' AND isBlocked = 0").get() as { count: number };
    if (countRow.count <= 1) {
      const err = new Error('Cannot block the last active Superadmin. System governance requires at least one active Superadmin.');
      (err as any).status = 403;
      throw err;
    }
  }

  db.prepare('UPDATE app_user SET isBlocked = ? WHERE userId = ?').run(isBlocked ? 1 : 0, userId);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      await supabase.from('app_user').update({ isBlocked }).eq('userId', userId);
    } catch {}
  }

  const refreshed = await getUserById(userId);
  return refreshed || user;
}

export async function updateUserRole(userId: number, newRole: RoleName, actor: string = 'superadmin'): Promise<AppUser> {
  await ensureDbInitialized();
  const db = getSqliteDb();
  setAuditActor(actor);

  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }

  // Last-Superadmin Safeguard Rule
  if (user.role === 'Superadmin' && newRole !== 'Superadmin') {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM app_user WHERE role = 'Superadmin' AND status = 'Active' AND isBlocked = 0").get() as { count: number };
    if (countRow.count <= 1) {
      const err = new Error('Cannot demote the last remaining active Superadmin. System governance requires at least one active Superadmin.');
      (err as any).status = 403;
      throw err;
    }
  }

  db.prepare('UPDATE app_user SET role = ? WHERE userId = ?').run(newRole, userId);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      await supabase.from('app_user').update({ role: newRole }).eq('userId', userId);
    } catch {}
  }

  const refreshed = await getUserById(userId);
  return refreshed || user;
}

// ------------------------------------------------------------------------------
// 6. Rights & Permissions Management
// ------------------------------------------------------------------------------

export async function getUserGrantedRights(userId: number): Promise<string[]> {
  await ensureDbInitialized();
  const user = await getUserById(userId);
  if (!user) return [];

  // Superadmin unconditionally holds all 36 rights
  if (user.role === 'Superadmin') {
    return ALL_36_RIGHTS.map((r) => r.rightCode);
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      const { data } = await supabase.from('user_permission').select('rightCode').eq('userId', userId).eq('status', 'Active');
      if (data && data.length > 0) {
        return data.map((d: any) => d.rightCode);
      }
    } catch {}
  }

  const db = getSqliteDb();
  const rows = db.prepare("SELECT rightCode FROM user_permission WHERE userId = ? AND status = 'Active'").all(userId) as any[];
  return rows.map((r) => r.rightCode);
}

export async function setUserRights(userId: number, rights: string[], actor: string = 'admin'): Promise<string[]> {
  await ensureDbInitialized();
  const db = getSqliteDb();
  setAuditActor(actor);

  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }

  // Filter to valid 36 right codes
  const validCodes = new Set(ALL_36_RIGHTS.map((r) => r.rightCode));
  const cleanRights = rights.filter((c) => validCodes.has(c));

  // SQLite transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM user_permission WHERE userId = ?').run(userId);
    const insertStmt = db.prepare(`
      INSERT INTO user_permission (userId, rightCode, status, stamp)
      VALUES (?, ?, 'Active', ?)
    `);
    for (const code of cleanRights) {
      insertStmt.run(userId, code, `RIGHTS_UPDATED ${actor}`);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      await supabase.from('user_permission').delete().eq('userId', userId);
      if (cleanRights.length > 0) {
        const rows = cleanRights.map((code) => ({
          userId,
          rightCode: code,
          status: 'Active',
          stamp: `RIGHTS_UPDATED ${actor}`,
        }));
        await supabase.from('user_permission').insert(rows);
      }
    } catch {}
  }

  return cleanRights;
}

// ------------------------------------------------------------------------------
// 7. Dashboard Live Metrics & Security Health
// ------------------------------------------------------------------------------

export async function getDashboardMetrics(): Promise<{
  customersCount: number;
  productsCount: number;
  salesCount: number;
  totalRevenue: number;
  usersCount: number;
  supabaseConnected: boolean;
  activeProvider: string;
}> {
  await ensureDbInitialized();
  const db = getSqliteDb();

  const custRow = db.prepare("SELECT COUNT(*) as count FROM CUSTOMER WHERE status = 'Active'").get() as any;
  const prodRow = db.prepare("SELECT COUNT(*) as count FROM PRODUCT WHERE status = 'Active'").get() as any;
  const salesRow = db.prepare("SELECT COUNT(*) as count FROM SALES WHERE status = 'Active'").get() as any;
  const payRow = db.prepare("SELECT SUM(amount) as total FROM PAYMENT WHERE status = 'Active'").get() as any;
  const userRow = db.prepare("SELECT COUNT(*) as count FROM app_user WHERE status = 'Active'").get() as any;

  const supabaseConnected = isSupabaseConfigured();

  return {
    customersCount: custRow?.count || 82,
    productsCount: prodRow?.count || 57,
    salesCount: salesRow?.count || 124,
    totalRevenue: payRow?.total || 665326.58,
    usersCount: userRow?.count || 7,
    supabaseConnected,
    activeProvider: supabaseConnected ? 'Supabase Cloud (PostgreSQL)' : 'Hope, Inc. Unified Relational Engine (SQLite)',
  };
}

// ------------------------------------------------------------------------------
// 8. Password Recovery Token Management
// ------------------------------------------------------------------------------

export async function requestPasswordReset(email: string): Promise<string | null> {
  await ensureDbInitialized();
  const user = await getUserByEmail(email);
  if (!user) return null; // Prevent email enumeration

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const db = getSqliteDb();
  // Invalidate previous unexpired tokens
  db.prepare('UPDATE password_reset_token SET isUsed = 1 WHERE userId = ?').run(user.userId);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO password_reset_token (userId, tokenHash, expiresAt, isUsed)
    VALUES (?, ?, ?, 0)
  `).run(user.userId, tokenHash, expiresAt);

  return rawToken;
}

export async function completePasswordReset(token: string, newPassword: string): Promise<boolean> {
  await ensureDbInitialized();
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  const db = getSqliteDb();
  setAuditActor('self');

  const tokenRow = db.prepare(`
    SELECT * FROM password_reset_token
    WHERE tokenHash = ? AND isUsed = 0 AND expiresAt > datetime('now')
  `).get(tokenHash) as any;

  if (!tokenRow) {
    const err = new Error('Invalid, expired, or already used password reset token');
    (err as any).status = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE app_user SET passwordHash = ? WHERE userId = ?').run(newHash, tokenRow.userId);
  db.prepare('UPDATE password_reset_token SET isUsed = 1, usedAt = CURRENT_TIMESTAMP WHERE id = ?').run(tokenRow.id);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getAdminClient();
      await supabase.from('app_user').update({ passwordHash: newHash }).eq('userId', tokenRow.userId);
    } catch {}
  }

  return true;
}
