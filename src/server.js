'use strict';

const { createApp } = require('./app');
const { loadEnv } = require('./config/env');
const { createPool } = require('./db/pool');

let env;
try {
  env = loadEnv();
} catch (err) {
  console.warn('[config] Notice: environment not fully configured, falling back to defaults:\n', err.message);
  env = {
    port: Number(process.env.PORT) || 3000,
    db: {
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT) || 5432,
      user: process.env.DB_USER || process.env.PGUSER || 'erp_user',
      password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.PGPASSWORD || 'change_me',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'erp_db',
    },
  };
}

// Initialize PostgreSQL connection pool
createPool(env && env.db ? env.db : undefined);

const app = createApp();
const PORT = env.port || 3000;

const server = app.listen(PORT, () => {
  console.log(`Hope ERP server is running on port ${PORT}`);
});

module.exports = server;
