#!/usr/bin/env node
'use strict';

/**
 * ==============================================================================
 * Hope, Inc. ERP — Database Migration Runner Script
 * Task ID: S1-DBA-01 (Issue #6)
 * Role: DevSecOps (@Chrollofuru)
 * ==============================================================================
 * Lightweight CLI migration tool for SQLite on Windows (Zero Docker Required).
 *
 * Supported Commands:
 *   node scripts/migrate/index.js up       - Apply all pending migrations in order
 *   node scripts/migrate/index.js down     - Rollback the most recently applied migration
 *   node scripts/migrate/index.js status   - Display migration status table
 *   node scripts/migrate/index.js reset    - Rollback all migrations and re-apply from scratch
 *   node scripts/migrate/index.js help     - Show usage instructions
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------------------
// 1. Environment Loading (.env support with zero-dependency fallback)
// ------------------------------------------------------------------------------
function loadEnvironment() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(envPath);
      } catch (err) {
        // Ignore parsing errors, fall back to dotenv
      }
    }
    if (!process.env.DB_PATH) {
      try {
        require('dotenv').config({ path: envPath });
      } catch (err) {
        // dotenv optional if process.loadEnvFile was used
      }
    }
  }
}

loadEnvironment();

// ------------------------------------------------------------------------------
// 2. Configuration & Paths
// ------------------------------------------------------------------------------
const parsedArgs = parseCommandLineArgs(process.argv.slice(2));
const command = parsedArgs.command || 'up';
const dbFilePath = path.resolve(
  process.cwd(),
  parsedArgs.db || process.env.DB_PATH || './data/erp_local.db'
);
const migrationsDir = path.resolve(
  process.cwd(),
  parsedArgs.dir || './migrations'
);

function parseCommandLineArgs(argv) {
  const result = { command: null, db: null, dir: null, steps: 1, force: false };
  for (const arg of argv) {
    if (arg.startsWith('--db=')) {
      result.db = arg.slice(5);
    } else if (arg.startsWith('--dir=')) {
      result.dir = arg.slice(6);
    } else if (arg.startsWith('--steps=')) {
      result.steps = parseInt(arg.slice(8), 10) || 1;
    } else if (arg === '--force' || arg === '-f') {
      result.force = true;
    } else if (!arg.startsWith('-') && !result.command) {
      result.command = arg.toLowerCase();
    }
  }
  return result;
}

// ------------------------------------------------------------------------------
// 3. Database Driver Adapter (Supports better-sqlite3 with native node:sqlite fallback)
// ------------------------------------------------------------------------------
class DatabaseAdapter {
  constructor(filePath) {
    this.filePath = filePath;
    this.driverType = null;
    this.db = null;

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Attempt 1: better-sqlite3
    try {
      const BetterSqlite3 = require('better-sqlite3');
      this.db = new BetterSqlite3(filePath);
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      this.driverType = 'better-sqlite3';
      return;
    } catch (e) {
      // better-sqlite3 not installed, attempt fallback
    }

    // Attempt 2: Node 22.5+ native node:sqlite
    try {
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(filePath);
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.driverType = 'node:sqlite';
      return;
    } catch (e) {
      // Neither available
    }

    console.error('\n❌ SQLite driver not available.');
    console.error('Please install dependencies by running:');
    console.error('   npm install\n');
    console.error('Or ensure you are running Node.js >= 22.5 for native SQLite support.\n');
    process.exit(1);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (typeof stmt.get === 'function') {
      return stmt.get(...params);
    }
    const rows = stmt.all(...params);
    return rows.length > 0 ? rows[0] : undefined;
  }

  close() {
    if (this.db && typeof this.db.close === 'function') {
      this.db.close();
    }
  }
}

// ------------------------------------------------------------------------------
// 4. Migration Helper Functions
// ------------------------------------------------------------------------------
const TRACKING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

function ensureTrackingTable(adapter) {
  adapter.exec(TRACKING_TABLE_SQL);
}

function getAppliedMigrations(adapter) {
  ensureTrackingTable(adapter);
  const rows = adapter.all(
    'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC'
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.version, row.applied_at);
  }
  return map;
}

function getMigrationFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs.readdirSync(dir);
  const migrations = [];

  for (const file of files) {
    if (file.endsWith('.down.sql')) {
      continue; // Skip paired down files
    }
    if (!file.endsWith('.sql')) {
      continue;
    }

    // Match leading numeric sequence (e.g. 001_init_core_schema.sql, 1-init.sql)
    const match = file.match(/^(\d+)[\-_](.*)\.sql$/i);
    const numericId = match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;

    const fullPath = path.join(dir, file);
    const downPath = path.join(dir, file.replace(/\.sql$/i, '.down.sql'));

    migrations.push({
      fileName: file,
      version: file, // Store filename as canonical version in schema_migrations
      numericId,
      fullPath,
      downPath: fs.existsSync(downPath) ? downPath : null,
    });
  }

  // Sort numerically ascending
  migrations.sort((a, b) => {
    if (a.numericId !== b.numericId) {
      return a.numericId - b.numericId;
    }
    return a.fileName.localeCompare(b.fileName);
  });

  return migrations;
}

function extractDownSql(migration) {
  // Option 1: Paired .down.sql file exists
  if (migration.downPath && fs.existsSync(migration.downPath)) {
    return fs.readFileSync(migration.downPath, 'utf8');
  }

  // Option 2: Embedded Down block inside main migration file
  const content = fs.readFileSync(migration.fullPath, 'utf8');
  const downMarker = /--\s*(?:---+)?\s*(?:DOWN|@down|Rollback)\s*(?:---+)?/i;
  const match = content.split(downMarker);
  if (match.length > 1) {
    return match[1].trim();
  }

  return null;
}

// ------------------------------------------------------------------------------
// 5. Commands Implementation
// ------------------------------------------------------------------------------
function runUp(adapter) {
  console.log(`\n============================================================`);
  console.log(` 🚀 Hope, Inc. ERP — Running Database Migrations (UP)`);
  console.log(`============================================================`);
  console.log(` Database:   ${dbFilePath}`);
  console.log(` Driver:     ${adapter.driverType}`);
  console.log(` Migrations: ${migrationsDir}`);
  console.log(`------------------------------------------------------------`);

  ensureTrackingTable(adapter);
  const applied = getAppliedMigrations(adapter);
  const allMigrations = getMigrationFiles(migrationsDir);

  if (allMigrations.length === 0) {
    console.log(`⚠️  No migration files found in "${migrationsDir}".`);
    return;
  }

  const pending = allMigrations.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log(`✨ Database is already up to date. No pending migrations.`);
    console.log(`   Applied migrations: ${applied.size} / ${allMigrations.length}\n`);
    return;
  }

  console.log(`Found ${pending.length} pending migration(s) to apply:\n`);

  let successCount = 0;
  for (const m of pending) {
    const startTime = Date.now();
    process.stdout.write(`  ⏳ [UP] Applying: ${m.fileName} ... `);

    const rawSql = fs.readFileSync(m.fullPath, 'utf8');
    // If migration has an embedded -- DOWN block, only execute the UP portion
    const downMarker = /--\s*(?:---+)?\s*(?:DOWN|@down|Rollback)\s*(?:---+)?/i;
    const upSql = rawSql.split(downMarker)[0];

    try {
      adapter.exec('BEGIN IMMEDIATE TRANSACTION;');
      adapter.exec(upSql);
      adapter.run(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP);',
        [m.version]
      );
      adapter.exec('COMMIT;');
      const elapsed = Date.now() - startTime;
      console.log(`DONE (${elapsed}ms)`);
      successCount++;
    } catch (err) {
      try {
        adapter.exec('ROLLBACK;');
      } catch (rollbackErr) {
        // Rollback attempt
      }
      console.log(`FAILED!`);
      console.error(`\n❌ Error applying migration: ${m.fileName}`);
      console.error(`   Message: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log(`------------------------------------------------------------`);
  console.log(`🎉 Success: Applied ${successCount} migration(s) successfully.\n`);
}

function runDown(adapter, steps = 1) {
  console.log(`\n============================================================`);
  console.log(` ⏪ Hope, Inc. ERP — Rolling Back Migrations (DOWN)`);
  console.log(`============================================================`);
  console.log(` Database:   ${dbFilePath}`);
  console.log(` Driver:     ${adapter.driverType}`);
  console.log(` Steps:      ${steps}`);
  console.log(`------------------------------------------------------------`);

  ensureTrackingTable(adapter);
  const applied = getAppliedMigrations(adapter);
  const allMigrations = getMigrationFiles(migrationsDir);

  if (applied.size === 0) {
    console.log(`ℹ️  No applied migrations found in database. Nothing to roll back.\n`);
    return;
  }

  // Get applied migrations sorted descending (most recent first)
  const appliedSorted = allMigrations
    .filter((m) => applied.has(m.version))
    .reverse();

  const toRollback = appliedSorted.slice(0, steps);

  if (toRollback.length === 0) {
    console.log(`ℹ️  No matching migrations to roll back.\n`);
    return;
  }

  console.log(`Rolling back ${toRollback.length} migration(s):\n`);

  let rollbackCount = 0;
  for (const m of toRollback) {
    const downSql = extractDownSql(m);
    if (!downSql) {
      console.error(
        `\n❌ Rollback failed for ${m.fileName}:`
      );
      console.error(
        `   No down script found. Create "${m.fileName.replace(
          /\.sql$/i,
          '.down.sql'
        )}" or add a "-- DOWN" section.\n`
      );
      process.exit(1);
    }

    const startTime = Date.now();
    process.stdout.write(`  ⏳ [DOWN] Reverting: ${m.fileName} ... `);

    try {
      adapter.exec('BEGIN IMMEDIATE TRANSACTION;');
      adapter.exec(downSql);
      adapter.run('DELETE FROM schema_migrations WHERE version = ?;', [m.version]);
      adapter.exec('COMMIT;');
      const elapsed = Date.now() - startTime;
      console.log(`DONE (${elapsed}ms)`);
      rollbackCount++;
    } catch (err) {
      try {
        adapter.exec('ROLLBACK;');
      } catch (rollbackErr) {
        // Rollback attempt
      }
      console.log(`FAILED!`);
      console.error(`\n❌ Error reverting migration: ${m.fileName}`);
      console.error(`   Message: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log(`------------------------------------------------------------`);
  console.log(`🎉 Success: Reverted ${rollbackCount} migration(s) successfully.\n`);
}

function runStatus(adapter) {
  console.log(`\n============================================================`);
  console.log(` 📊 Hope, Inc. ERP — Migration Status`);
  console.log(`============================================================`);
  console.log(` Database:   ${dbFilePath}`);
  console.log(` Driver:     ${adapter.driverType}`);
  console.log(` Migrations: ${migrationsDir}`);
  console.log(`------------------------------------------------------------`);

  ensureTrackingTable(adapter);
  const applied = getAppliedMigrations(adapter);
  const allMigrations = getMigrationFiles(migrationsDir);

  if (allMigrations.length === 0) {
    console.log(`⚠️  No migration files found in "${migrationsDir}".\n`);
    return;
  }

  const colVersion = 36;
  const colStatus = 12;
  const colDate = 24;

  const header = `| ${'Migration Version / File'.padEnd(colVersion)} | ${'Status'.padEnd(colStatus)} | ${'Applied At (UTC)'.padEnd(colDate)} |`;
  const divider = `|-${'-'.repeat(colVersion)}-|-${'-'.repeat(colStatus)}-|-${'-'.repeat(colDate)}-|`;

  console.log(header);
  console.log(divider);

  let appliedCount = 0;
  let pendingCount = 0;

  for (const m of allMigrations) {
    const isApplied = applied.has(m.version);
    const statusText = isApplied ? '✅ APPLIED' : '⏳ PENDING';
    const appliedAt = isApplied ? applied.get(m.version) : '-';

    if (isApplied) appliedCount++;
    else pendingCount++;

    const row = `| ${m.fileName.padEnd(colVersion)} | ${statusText.padEnd(colStatus)} | ${String(appliedAt).padEnd(colDate)} |`;
    console.log(row);
  }

  console.log(divider);
  console.log(
    ` Summary: Total: ${allMigrations.length} | Applied: ${appliedCount} | Pending: ${pendingCount}\n`
  );
}

function runReset(adapter) {
  console.log(`\n============================================================`);
  console.log(` 🔄 Hope, Inc. ERP — Resetting Local Database`);
  console.log(`============================================================`);
  console.log(` Target: ${dbFilePath}`);
  console.log(`------------------------------------------------------------`);

  ensureTrackingTable(adapter);
  const applied = getAppliedMigrations(adapter);

  if (applied.size > 0) {
    console.log(`Reverting all ${applied.size} applied migration(s)...`);
    runDown(adapter, applied.size);
  } else {
    console.log(`No applied migrations to revert.`);
  }

  console.log(`Re-applying all migrations from scratch...`);
  runUp(adapter);
}

function printHelp() {
  console.log(`
Hope, Inc. ERP — SQLite Migration Runner CLI (S1-DBA-01)

Usage:
  node scripts/migrate/index.js <command> [options]
  npm run migrate:<command>

Commands:
  up                Apply all pending migrations in sequential order (Default)
  down              Rollback the most recent migration (use --steps=N for more)
  status            Show status table of all migrations (Applied vs Pending)
  reset             Rollback all applied migrations and re-apply from scratch
  help              Display this help documentation

Options:
  --db=<path>       Path to SQLite database file (default: ./data/erp_local.db or DB_PATH)
  --dir=<path>      Path to migrations folder (default: ./migrations)
  --steps=<number>  Number of migrations to roll back in 'down' command (default: 1)

Examples:
  node scripts/migrate/index.js up
  node scripts/migrate/index.js status
  node scripts/migrate/index.js down --steps=1
  node scripts/migrate/index.js reset
  npm run migrate:up
  npm run migrate:status
`);
}

// ------------------------------------------------------------------------------
// 6. Main Runner
// ------------------------------------------------------------------------------
function main() {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  const adapter = new DatabaseAdapter(dbFilePath);

  try {
    switch (command) {
      case 'up':
        runUp(adapter);
        break;
      case 'down':
        runDown(adapter, parsedArgs.steps);
        break;
      case 'status':
        runStatus(adapter);
        break;
      case 'reset':
        runReset(adapter);
        break;
      default:
        console.error(`\n❌ Unknown command: "${command}"`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Unexpected migration error: ${err.message}`);
    process.exit(1);
  } finally {
    adapter.close();
  }
}

if (require.main === module) {
  main();
}
