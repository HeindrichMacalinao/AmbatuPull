'use strict';

/**
 * Health check controller for Hope, Inc. ERP backend.
 * Provides system status and database connectivity reporting for /api/health.
 */
async function getHealth(req, res) {
  let dbStatus = { status: 'unconfigured' };

  try {
    const { checkConnection } = require('../db/pool');
    if (typeof checkConnection === 'function') {
      dbStatus = await checkConnection();
    }
  } catch (err) {
    dbStatus = { connected: false, error: err.message || 'database check failed' };
  }

  const isDegraded = dbStatus.connected === false;
  const statusCode = isDegraded ? 503 : 200;

  res.status(statusCode).json({
    status: isDegraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
  });
}

module.exports = { getHealth };
