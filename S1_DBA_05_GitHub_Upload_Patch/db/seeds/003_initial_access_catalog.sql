-- S1-DBA-05 | Official five-module / 36-right catalog | SQLite 3
-- Source: HOPE ERP Student Guide Section 3.8, as transcribed in GitHub issue #10.
-- Prerequisite: db/migrations/002_user_management_tables.sql (module, rights).
-- Idempotent for an unchanged catalog. Never stores passwords, personal details,
-- or placeholder user accounts; see scripts/seed_superadmins.py for secure setup.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT INTO "module" ("moduleCode", "moduleName") VALUES
    ('customer', 'Customer'),
    ('product', 'Product'),
    ('human_resources', 'Human Resources'),
    ('sales', 'Sales'),
    ('reports', 'Reports')
ON CONFLICT("moduleCode") DO NOTHING;

INSERT INTO "rights" ("rightCode", "moduleCode", "description") VALUES
    ('customer.add', 'customer', 'Add Customer'),
    ('customer.edit', 'customer', 'Edit Customer'),
    ('customer.delete', 'customer', 'Delete Customer (Soft delete)'),
    ('product.add', 'product', 'Add Product'),
    ('product.edit', 'product', 'Edit Product'),
    ('product.delete', 'product', 'Delete Product'),
    ('price.add', 'product', 'Add Price'),
    ('price.edit', 'product', 'Edit Price'),
    ('price.delete', 'product', 'Delete Price'),
    ('job.add', 'human_resources', 'Add Job'),
    ('job.edit', 'human_resources', 'Edit Job'),
    ('job.delete', 'human_resources', 'Delete Job'),
    ('dept.add', 'human_resources', 'Add Department'),
    ('dept.edit', 'human_resources', 'Edit Department'),
    ('dept.delete', 'human_resources', 'Delete Department'),
    ('emp.add', 'human_resources', 'Add Employee'),
    ('emp.edit', 'human_resources', 'Edit Employee'),
    ('emp.delete', 'human_resources', 'Delete Employee'),
    ('jobhistory.view', 'human_resources', 'View Job History (Data Privacy Act gatekeeper)'),
    ('jobhistory.add', 'human_resources', 'Add Job History'),
    ('jobhistory.edit', 'human_resources', 'Edit Job History'),
    ('jobhistory.delete', 'human_resources', 'Delete Job History'),
    ('sale.add', 'sales', 'Add Sale'),
    ('sale.edit', 'sales', 'Edit Sale'),
    ('sale.delete', 'sales', 'Delete Sale'),
    ('saledetail.view', 'sales', 'View Sale Detail'),
    ('saledetail.add', 'sales', 'Add Sale Detail'),
    ('saledetail.edit', 'sales', 'Edit Sale Detail'),
    ('saledetail.delete', 'sales', 'Delete Sale Detail'),
    ('report.top_customers', 'reports', 'Top Customers Report'),
    ('report.product_master', 'reports', 'Product Master Report'),
    ('report.top_products', 'reports', 'Top Products Report'),
    ('report.active_emp', 'reports', 'Active Employees Report'),
    ('report.all_emp', 'reports', 'All Employees Report'),
    ('report.emp_job_history', 'reports', 'Employee Job History Report'),
    ('report.top_sales', 'reports', 'Top Sales Report')
ON CONFLICT("rightCode") DO NOTHING;

COMMIT;
