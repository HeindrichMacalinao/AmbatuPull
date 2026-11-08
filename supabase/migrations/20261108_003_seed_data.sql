-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 003: Seed Foundation Data
-- (Supabase / PostgreSQL)
-- ==============================================================================

-- 1. SEED ROLES
INSERT INTO "role" ("roleName", "description", "status", "stamp")
VALUES
    ('Superadmin', 'Full system control, governance, user management, and audit inspection', 'Active', 'SEED'),
    ('Admin', 'Operational department administrator with broad module management', 'Active', 'SEED'),
    ('User', 'Standard end-user with assigned operational permissions', 'Active', 'SEED')
ON CONFLICT ("roleName") DO NOTHING;

-- 2. SEED MODULES (5 core operational business modules)
INSERT INTO "module" ("moduleCode", "moduleName", "status", "stamp")
VALUES
    ('customer', 'Customer Management', 'Active', 'SEED'),
    ('product', 'Product & Pricing Catalog', 'Active', 'SEED'),
    ('human_resources', 'Human Resources & Payroll', 'Active', 'SEED'),
    ('sales', 'Sales & Payments Processing', 'Active', 'SEED'),
    ('reports', 'Business Intelligence & Reports', 'Active', 'SEED')
ON CONFLICT ("moduleCode") DO NOTHING;

-- 3. SEED 36 GRANULAR RIGHTS CATALOGUE
INSERT INTO "rights" ("rightCode", "moduleCode", "description", "status", "stamp")
VALUES
    -- Customer Module (3)
    ('customer.add', 'customer', 'Create new customer records', 'Active', 'SEED'),
    ('customer.edit', 'customer', 'Modify existing customer profiles and credit limits', 'Active', 'SEED'),
    ('customer.delete', 'customer', 'Deactivate or delete customer accounts', 'Active', 'SEED'),

    -- Product & Price Module (6)
    ('product.add', 'product', 'Add new products to catalog', 'Active', 'SEED'),
    ('product.edit', 'product', 'Edit product descriptions and units', 'Active', 'SEED'),
    ('product.delete', 'product', 'Archive or delete products from active catalog', 'Active', 'SEED'),
    ('price.add', 'product', 'Define new effective price points', 'Active', 'SEED'),
    ('price.edit', 'product', 'Update historical price schedules', 'Active', 'SEED'),
    ('price.delete', 'product', 'Remove invalid price history records', 'Active', 'SEED'),

    -- Human Resources Module (13)
    ('dept.add', 'human_resources', 'Create operational departments', 'Active', 'SEED'),
    ('dept.edit', 'human_resources', 'Edit department details and structures', 'Active', 'SEED'),
    ('dept.delete', 'human_resources', 'Deactivate organizational departments', 'Active', 'SEED'),
    ('job.add', 'human_resources', 'Define job positions and grades', 'Active', 'SEED'),
    ('job.edit', 'human_resources', 'Modify job descriptions and compensation bands', 'Active', 'SEED'),
    ('job.delete', 'human_resources', 'Retire obsolete job titles', 'Active', 'SEED'),
    ('emp.add', 'human_resources', 'Onboard new company personnel', 'Active', 'SEED'),
    ('emp.edit', 'human_resources', 'Update employee personal records', 'Active', 'SEED'),
    ('emp.delete', 'human_resources', 'Record employee termination or separation', 'Active', 'SEED'),
    ('jobhistory.view', 'human_resources', 'View confidential salary and promotion timelines (RA 10173)', 'Active', 'SEED'),
    ('jobhistory.add', 'human_resources', 'Record salary increments and job transfers', 'Active', 'SEED'),
    ('jobhistory.edit', 'human_resources', 'Correct recorded employment timeline entries', 'Active', 'SEED'),
    ('jobhistory.delete', 'human_resources', 'Remove erroneously entered job history entries', 'Active', 'SEED'),

    -- Sales & Payments Module (7)
    ('sale.add', 'sales', 'Generate new sales orders and invoices', 'Active', 'SEED'),
    ('sale.edit', 'sales', 'Modify unfinalized sales transactions', 'Active', 'SEED'),
    ('sale.delete', 'sales', 'Cancel or void sales transactions', 'Active', 'SEED'),
    ('saledetail.view', 'sales', 'Inspect line-item sales breakdowns', 'Active', 'SEED'),
    ('saledetail.add', 'sales', 'Add line item products to active sales invoice', 'Active', 'SEED'),
    ('saledetail.edit', 'sales', 'Adjust sale line item prices or discounts', 'Active', 'SEED'),
    ('saledetail.delete', 'sales', 'Remove line items from unposted orders', 'Active', 'SEED'),

    -- Reports Module (7)
    ('report.top_customers', 'reports', 'Generate report of highest grossing customer accounts', 'Active', 'SEED'),
    ('report.product_master', 'reports', 'Export comprehensive master product directory', 'Active', 'SEED'),
    ('report.top_products', 'reports', 'Analyze best-selling products by quantity and revenue', 'Active', 'SEED'),
    ('report.active_emp', 'reports', 'Generate roster of currently employed active personnel', 'Active', 'SEED'),
    ('report.all_emp', 'reports', 'Generate complete historical personnel registry', 'Active', 'SEED'),
    ('report.emp_job_history', 'reports', 'Audit individual career timeline, rank, and compensation history', 'Active', 'SEED'),
    ('report.top_sales', 'reports', 'Review highest-value sales transactions and volume metrics', 'Active', 'SEED')
ON CONFLICT ("rightCode") DO NOTHING;

-- 4. SEED SAMPLE DEPARTMENTS & EMPLOYEES
INSERT INTO "DEPARTMENT" ("deptCode", "deptName", "status", "stamp")
VALUES
    ('IT', 'Information Technology & Systems', 'Active', 'SEED'),
    ('FIN', 'Finance & Accounting', 'Active', 'SEED'),
    ('HR', 'Human Resources Management', 'Active', 'SEED'),
    ('SALES', 'Commercial Sales & Business Dev', 'Active', 'SEED')
ON CONFLICT ("deptCode") DO NOTHING;

INSERT INTO "JOB" ("jobCode", "jobDesc", "status", "stamp")
VALUES
    ('SYS_ADMIN', 'Systems Administrator / Architect', 'Active', 'SEED'),
    ('FIN_MGR', 'Finance & Treasury Manager', 'Active', 'SEED'),
    ('HR_SPEC', 'Human Resource Specialist', 'Active', 'SEED'),
    ('SALES_REP', 'Senior Sales Representative', 'Active', 'SEED')
ON CONFLICT ("jobCode") DO NOTHING;

INSERT INTO "EMPLOYEE" ("empNo", "lastName", "firstName", "midName", "deptCode", "jobCode", "dateHired", "status", "stamp")
VALUES
    ('EMP001', 'Macalinao', 'Heindrich', 'H', 'IT', 'SYS_ADMIN', '2024-01-15', 'Active', 'SEED'),
    ('EMP002', 'Gavarra', 'Alex', 'M', 'SALES', 'SALES_REP', '2024-02-01', 'Active', 'SEED'),
    ('EMP003', 'Chrollo', 'Lucilfer', 'X', 'IT', 'SYS_ADMIN', '2024-01-20', 'Active', 'SEED')
ON CONFLICT ("empNo") DO NOTHING;

-- 5. SEED INITIAL SUPERADMIN & USERS
-- Password for demo accounts: Admin@123456
-- Precomputed bcrypt ($2a$12$...) hash:
-- $2a$12$r7rUq3bL35G6fA.ZpUj9feJmN/k9x7R.X9KzL6o6sC7U1Yk2WlDxy
INSERT INTO "app_user" ("firstName", "lastName", "email", "passwordHash", "role", "isBlocked", "empNo", "status", "stamp")
VALUES
    ('Super', 'Admin', 'superadmin@hope-erp.local', '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U', 'Superadmin', FALSE, 'EMP001', 'Active', 'SEED'),
    ('Operations', 'Admin', 'admin@hope-erp.local', '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U', 'Admin', FALSE, 'EMP002', 'Active', 'SEED'),
    ('Standard', 'Staff', 'user@hope-erp.local', '$2a$12$4mPZ6w51Q6uL3kR6r.K96uD8pU8k2fL3J9f5oN9R.X9KzL6o6sC7U', 'User', FALSE, 'EMP003', 'Active', 'SEED')
ON CONFLICT ("email") DO NOTHING;

-- 6. GRANT ALL 36 RIGHTS TO SUPERADMIN (userId = 1)
INSERT INTO "user_permission" ("userId", "rightCode", "status", "stamp")
SELECT u."userId", r."rightCode", 'Active', 'SEED'
FROM "app_user" u
CROSS JOIN "rights" r
WHERE u."email" = 'superadmin@hope-erp.local'
ON CONFLICT ("userId", "rightCode") DO NOTHING;
