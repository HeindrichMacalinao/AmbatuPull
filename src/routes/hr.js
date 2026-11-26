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
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  restoreEmployee,
  getJobHistory,
  createJobHistory,
  updateJobHistory,
  deleteJobHistory,
  restoreJobHistory,
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

const employeesRouter = express.Router();
employeesRouter.use(authenticate);
employeesRouter.use(requireHrAccess);

// Employees List & Mutation API (S3-DEV-04, S3-DEV-05, S3-DEV-06)
employeesRouter.get('/', getEmployees);
employeesRouter.post('/', requireRight('emp.add'), createEmployee);
employeesRouter.put('/:empNo', requireRight('emp.edit'), updateEmployee);
employeesRouter.delete('/:empNo', requireRight('emp.delete'), deleteEmployee);
employeesRouter.post('/:empNo/restore', requireAdminOrSuperadmin, restoreEmployee);
employeesRouter.put('/:empNo/restore', requireAdminOrSuperadmin, restoreEmployee);

// Job History Timeline API (S3-DEV-07)
employeesRouter.get('/:empNo/history', getJobHistory);
employeesRouter.post('/:empNo/history', requireRight('jobhistory.add'), createJobHistory);
employeesRouter.put('/:empNo/history/:jobCode/:effDate', requireRight('jobhistory.edit'), updateJobHistory);
employeesRouter.delete('/:empNo/history/:jobCode/:effDate', requireRight('jobhistory.delete'), deleteJobHistory);
employeesRouter.post('/:empNo/history/:jobCode/:effDate/restore', requireAdminOrSuperadmin, restoreJobHistory);
employeesRouter.put('/:empNo/history/:jobCode/:effDate/restore', requireAdminOrSuperadmin, restoreJobHistory);

const router = express.Router();
router.use('/jobs', jobsRouter);
router.use('/departments', departmentsRouter);
router.use('/employees', employeesRouter);
router.jobsRouter = jobsRouter;
router.departmentsRouter = departmentsRouter;
router.employeesRouter = employeesRouter;

module.exports = router;
