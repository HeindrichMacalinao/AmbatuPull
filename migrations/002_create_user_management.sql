-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 002: User Management & RBAC Foundation
-- Task ID: S1-DBA-01 / S1-DBA-03 / S1-DBA-04 (Issue #6, #8, #9)
-- Target: SQLite (UTF-8, No Docker)
-- ==============================================================================

-- 1. ROLE TABLE
CREATE TABLE IF NOT EXISTS role (
    roleName VARCHAR(20) PRIMARY KEY,
    description TEXT,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 2. MODULE TABLE
CREATE TABLE IF NOT EXISTS module (
    moduleCode VARCHAR(30) PRIMARY KEY,
    moduleName VARCHAR(50) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
);

-- 3. RIGHTS CATALOGUE TABLE
CREATE TABLE IF NOT EXISTS rights (
    rightCode VARCHAR(50) PRIMARY KEY,
    moduleCode VARCHAR(30) NOT NULL,
    description VARCHAR(150) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    FOREIGN KEY (moduleCode) REFERENCES module (moduleCode) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. APP_USER TABLE
CREATE TABLE IF NOT EXISTS app_user (
    userId INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'User',
    isBlocked BOOLEAN NOT NULL DEFAULT 0 CHECK (isBlocked IN (0, 1)),
    empNo VARCHAR(10),
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    FOREIGN KEY (role) REFERENCES role (roleName) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (empNo) REFERENCES EMPLOYEE (empNo) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. USER_PERMISSION JUNCTION TABLE
CREATE TABLE IF NOT EXISTS user_permission (
    userId INTEGER NOT NULL,
    rightCode VARCHAR(50) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL,
    PRIMARY KEY (userId, rightCode),
    FOREIGN KEY (userId) REFERENCES app_user (userId) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (rightCode) REFERENCES rights (rightCode) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. PASSWORD RESET TOKEN TABLE
CREATE TABLE IF NOT EXISTS password_reset_token (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    tokenHash VARCHAR(255) NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    isUsed BOOLEAN NOT NULL DEFAULT 0 CHECK (isUsed IN (0, 1)),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usedAt TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES app_user (userId) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON app_user(email);
CREATE INDEX IF NOT EXISTS idx_user_role ON app_user(role);
CREATE INDEX IF NOT EXISTS idx_user_status ON app_user(status);
CREATE INDEX IF NOT EXISTS idx_permission_user ON user_permission(userId);
CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_token(tokenHash);

-- Initial Role Seeds
INSERT OR IGNORE INTO role (roleName, description, status, stamp) VALUES
('Superadmin', 'Unrestricted system-wide governance and administrative rights', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('Admin', 'Administrative user management and operational rights', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('User', 'Standard operational user with granular assigned rights', 'Active', 'CREATED system 2026-10-25 00:00:00');

-- Initial Module Seeds (5 Core Modules)
INSERT OR IGNORE INTO module (moduleCode, moduleName, status, stamp) VALUES
('customer', 'Customer Management', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('product', 'Product Catalog & Pricing', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('human_resources', 'Human Resources', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('sales', 'Sales Orders & Invoicing', 'Active', 'CREATED system 2026-10-25 00:00:00'),
('reports', 'Business Reports & Analytics', 'Active', 'CREATED system 2026-10-25 00:00:00');
