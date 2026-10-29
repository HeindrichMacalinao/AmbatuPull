'use strict';

const { Pool } = require('pg');

let pool = null;

/**
 * Create the shared connection pool.
 * pg re-establishes dropped connections automatically: a client that errors while
 * idle is removed from the pool and a fresh one is opened on the next query.
 * We add a startup retry loop and an idle-error handler so a DB restart
 * never crashes the process.
 */
function createPool(dbConfig = {}) {
  if (pool) return pool;

  pool = new Pool({
    host: dbConfig.host || process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: Number(dbConfig.port || process.env.DB_PORT || process.env.PGPORT || 5432),
    user: dbConfig.user || process.env.DB_USER || process.env.PGUSER || 'erp_user',
    password: dbConfig.password || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database: dbConfig.database || process.env.DB_NAME || process.env.PGDATABASE || 'erp_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  });

  // An idle client emitting an error (e.g. DB restarted) must not crash Node.
  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client:', err.message);
  });

  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database pool has not been initialised');
  return pool;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Try to connect with exponential backoff. Resolves true if connected,
 * false if all attempts failed (server still starts; /api/health reports the failure).
 */
async function connectWithRetry({ attempts = 5, baseDelayMs = 500 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getPool().query('SELECT 1');
      console.log('[db] Connected to PostgreSQL');
      return true;
    } catch (err) {
      const delay = baseDelayMs * 2 ** (i - 1);
      console.error(`[db] Connection attempt ${i}/${attempts} failed: ${err.message || err.code}`);
      if (i < attempts) await sleep(delay);
    }
  }
  console.error('[db] Could not connect; continuing. Pool will keep retrying on demand.');
  return false;
}

async function checkConnection() {
  const started = Date.now();
  try {
    await getPool().query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { connected: false, error: err.message || err.code || 'unknown error' };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { createPool, getPool, connectWithRetry, checkConnection, closePool };
