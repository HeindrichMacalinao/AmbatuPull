'use strict';

const express = require('express');
const {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  restoreJob,
} = require('../controllers/hrController');
const {
  authenticate,
  requireHrAccess,
  requireRight,
  requireAdminOrSuperadmin,
} = require('../middleware/authMiddleware');

const jobsRouter = express.Router();
jobsRouter.use(authenticate);
jobsRouter.use(requireHrAccess);

// Jobs Lookup & Mutation API (S3-DEV-01 & S3-DEV-02)
jobsRouter.get('/', getJobs);
jobsRouter.post('/', requireRight('job.add'), createJob);
jobsRouter.put('/:jobCode', requireRight('job.edit'), updateJob);
jobsRouter.delete('/:jobCode', requireRight('job.delete'), deleteJob);
jobsRouter.post('/:jobCode/restore', requireAdminOrSuperadmin, restoreJob);
jobsRouter.put('/:jobCode/restore', requireAdminOrSuperadmin, restoreJob);

const router = express.Router();
router.use('/jobs', jobsRouter);
router.jobsRouter = jobsRouter;

module.exports = router;
