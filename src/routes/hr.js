'use strict';

const express = require('express');
const {
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  restoreJob,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
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

const departmentsRouter = express.Router();
departmentsRouter.use(authenticate);
departmentsRouter.use(requireHrAccess);

// Departments Management API (S3-DEV-03)
departmentsRouter.get('/', getDepartments);
departmentsRouter.post('/', requireRight('dept.add'), createDepartment);
departmentsRouter.put('/:deptCode', requireRight('dept.edit'), updateDepartment);
departmentsRouter.delete('/:deptCode', requireRight('dept.delete'), deleteDepartment);
departmentsRouter.post('/:deptCode/restore', requireAdminOrSuperadmin, restoreDepartment);
departmentsRouter.put('/:deptCode/restore', requireAdminOrSuperadmin, restoreDepartment);

const router = express.Router();
router.use('/jobs', jobsRouter);
router.use('/departments', departmentsRouter);
router.jobsRouter = jobsRouter;
router.departmentsRouter = departmentsRouter;

module.exports = router;
