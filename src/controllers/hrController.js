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

/**
 * POST /api/hr/jobs & POST /api/jobs (Create Job)
 */
async function createJob(req, res, next) {
  try {
    const job = await hrService.createJob({
      data: req.body,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Job created successfully',
      job,
      ...job,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/hr/jobs/:jobCode & PUT /api/jobs/:jobCode (Edit Job)
 */
async function updateJob(req, res, next) {
  try {
    const job = await hrService.updateJob({
      jobCode: req.params.jobCode,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Job updated successfully',
      job,
      ...job,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/hr/jobs/:jobCode & DELETE /api/jobs/:jobCode (Soft Delete Job)
 */
async function deleteJob(req, res, next) {
  try {
    const job = await hrService.softDeleteJob({
      jobCode: req.params.jobCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Job deleted successfully',
      job,
      ...job,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST / PUT /api/hr/jobs/:jobCode/restore (Restore Job)
 */
async function restoreJob(req, res, next) {
  try {
    const job = await hrService.restoreJob({
      jobCode: req.params.jobCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Job restored successfully',
      job,
      ...job,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  restoreJob,
};
