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

/**
 * GET /api/hr/departments
 */
async function getDepartments(req, res, next) {
  try {
    const result = await hrService.listDepartments({
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
 * POST /api/hr/departments (Create Department)
 */
async function createDepartment(req, res, next) {
  try {
    const department = await hrService.createDepartment({
      data: req.body,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Department created successfully',
      department,
      ...department,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/hr/departments/:deptCode (Edit Department)
 */
async function updateDepartment(req, res, next) {
  try {
    const department = await hrService.updateDepartment({
      deptCode: req.params.deptCode,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Department updated successfully',
      department,
      ...department,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/hr/departments/:deptCode (Soft Delete Department)
 */
async function deleteDepartment(req, res, next) {
  try {
    const department = await hrService.softDeleteDepartment({
      deptCode: req.params.deptCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Department deleted successfully',
      department,
      ...department,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST / PUT /api/hr/departments/:deptCode/restore (Restore Department)
 */
async function restoreDepartment(req, res, next) {
  try {
    const department = await hrService.restoreDepartment({
      deptCode: req.params.deptCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Department restored successfully',
      department,
      ...department,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/hr/employees
 */
async function getEmployees(req, res, next) {
  try {
    const result = await hrService.listEmployees({
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
 * POST /api/hr/employees (Create Employee)
 */
async function createEmployee(req, res, next) {
  try {
    const employee = await hrService.createEmployee({
      data: req.body,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Employee created successfully',
      employee,
      ...employee,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/hr/employees/:empNo (Edit Employee)
 */
async function updateEmployee(req, res, next) {
  try {
    const employee = await hrService.updateEmployee({
      empNo: req.params.empNo,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Employee updated successfully',
      employee,
      ...employee,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/hr/employees/:empNo (Soft Delete Employee)
 */
async function deleteEmployee(req, res, next) {
  try {
    const employee = await hrService.softDeleteEmployee({
      empNo: req.params.empNo,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Employee deleted successfully',
      employee,
      ...employee,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST / PUT /api/hr/employees/:empNo/restore (Restore Employee)
 */
async function restoreEmployee(req, res, next) {
  try {
    const employee = await hrService.restoreEmployee({
      empNo: req.params.empNo,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Employee restored successfully',
      employee,
      ...employee,
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
};
