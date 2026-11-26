'use strict';

const hrService = require('../services/hrService');

/**
 * GET /api/hr/jobs & GET /api/jobs
 */
async function getJobs(req, res, next) {
  try {
    const result = await hrService.listJobs({
      requester: req.user,
      search: req.query.search,
      status: req.query.status,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getJobs,
};
