'use strict';

require('dotenv').config();

function loadEnv(source = process.env) {
  const errors = [];

  const dbClient = (source.DB_CLIENT || (source.DB_HOST || source.PGHOST ? 'pg' : 'sqlite')).toLowerCase();
  const isPostgres = dbClient === 'pg' || dbClient === 'postgres';

  const dbPass = source.DB_PASS !== undefined && String(source.DB_PASS).trim() !== ''
    ? source.DB_PASS
    : (source.DB_PASSWORD !== undefined && String(source.DB_PASSWORD).trim() !== ''
        ? source.DB_PASSWORD
        : source.PGPASSWORD);

  const required = [
    'PORT',
    'SESSION_SECRET',
    'APP_URL',
  ];

  for (const key of required) {
    if (source[key] === undefined || String(source[key]).trim() === '') {
      errors.push(`${key} is missing`);
    }
  }

  if (isPostgres) {
    if (!source.DB_HOST && !source.PGHOST) errors.push('DB_HOST is missing');
    if (!source.DB_PORT && !source.PGPORT) errors.push('DB_PORT is missing');
    if (!source.DB_USER && !source.PGUSER) errors.push('DB_USER is missing');
    if (!dbPass) errors.push('DB_PASS is missing');
    if (!source.DB_NAME && !source.PGDATABASE) errors.push('DB_NAME is missing');
  }

  const toPort = (key) => {
    const n = Number(source[key]);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      errors.push(`${key} must be an integer between 1 and 65535`);
    }
    return n;
  };

  const port = source.PORT ? toPort('PORT') : 3000;
  const rawDbPortKey = source.DB_PORT ? 'DB_PORT' : (source.PGPORT ? 'PGPORT' : undefined);
  const dbPort = rawDbPortKey ? toPort(rawDbPortKey) : (isPostgres ? 5432 : undefined);

  if (source.SESSION_SECRET && source.SESSION_SECRET.length < 16) {
    errors.push('SESSION_SECRET must be at least 16 characters');
  }

  if (source.APP_URL) {
    try {
      const u = new URL(source.APP_URL);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
      errors.push('APP_URL must be a valid http(s) URL');
    }
  }

  if (errors.length > 0) {
    const msg = ['Invalid environment configuration:', ...errors.map((e) => `  - ${e}`)].join('\n');
    throw new Error(msg);
  }

  const dbPath = source.DB_PATH || './data/erp_local.db';

  return Object.freeze({
    port,
    dbClient,
    dbPath,
    db: Object.freeze({
      client: dbClient,
      path: dbPath,
      host: source.DB_HOST || source.PGHOST || 'localhost',
      port: dbPort || 5432,
      user: source.DB_USER || source.PGUSER || 'erp_user',
      password: dbPass !== undefined ? dbPass : '',
      database: source.DB_NAME || source.PGDATABASE || 'erp_db',
    }),
    sessionSecret: source.SESSION_SECRET,
    appUrl: source.APP_URL,
  });
}

module.exports = { loadEnv };
