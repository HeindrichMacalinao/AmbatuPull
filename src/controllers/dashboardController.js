'use strict';

const dashboardService = require('../services/dashboardService');

/**
 * GET /api/dashboard/metrics
 */
async function getDashboardMetrics(req, res, next) {
  try {
    const data = await dashboardService.getDashboardMetrics();
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardMetrics,
};
