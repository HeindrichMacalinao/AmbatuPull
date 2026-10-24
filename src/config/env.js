'use strict';

require('dotenv').config();

const REQUIRED = [
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'SESSION_SECRET',
  'APP_URL',
];

function loadEnv(source = process.env) {
  const errors = [];

  for (const key of REQUIRED) {
    if (source[key] === undefined || String(source[key]).trim() === '') {
      errors.push(`${key} is missing`);
    }
  }

  const toPort = (key) => {
    const n = Number(source[key]);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      errors.push(`${key} must be an integer between 1 and 65535`);
    }
    return n;
  };

  const port = source.PORT ? toPort('PORT') : undefined;
  const dbPort = source.DB_PORT ? toPort('DB_PORT') : undefined;

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

  return Object.freeze({
    port,
    db: Object.freeze({
      host: source.DB_HOST,
      port: dbPort,
      user: source.DB_USER,
      password: source.DB_PASS,
      database: source.DB_NAME,
    }),
    sessionSecret: source.SESSION_SECRET,
    appUrl: source.APP_URL,
  });
}

module.exports = { loadEnv };
