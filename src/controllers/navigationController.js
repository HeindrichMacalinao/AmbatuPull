'use strict';

const dashboardService = require('../services/dashboardService');

/**
 * GET /api/navigation
 */
async function getNavigation(req, res, next) {
  try {
    const nav = await dashboardService.getNavigation({ user: req.user });
    res.status(200).json(nav);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNavigation,
};
