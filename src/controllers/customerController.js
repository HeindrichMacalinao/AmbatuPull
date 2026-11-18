'use strict';

const customerService = require('../services/customerService');

/**
 * GET /api/customers
 */
async function getCustomers(req, res, next) {
  try {
    const customers = await customerService.listCustomers({
      requester: req.user,
      search: req.query.search,
      status: req.query.status,
    });
    res.status(200).json({ customers, total: customers.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/customers/:custNo
 */
async function getCustomer(req, res, next) {
  try {
    const customer = await customerService.getCustomerByNo({
      custNo: req.params.custNo,
      requester: req.user,
    });
    res.status(200).json({ customer, ...customer });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/customers (Create Customer)
 */
async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer({
      data: req.body,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Customer created successfully',
      customer,
      ...customer,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/customers/:custNo (Edit Customer)
 */
async function updateCustomer(req, res, next) {
  try {
    const customer = await customerService.updateCustomer({
      custNo: req.params.custNo,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Customer updated successfully',
      customer,
      ...customer,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/customers/:custNo (Soft Delete Customer)
 */
async function deleteCustomer(req, res, next) {
  try {
    const customer = await customerService.softDeleteCustomer({
      custNo: req.params.custNo,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Customer soft deleted successfully',
      customer,
      ...customer,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/customers/:custNo/restore (Restore Customer)
 */
async function restoreCustomer(req, res, next) {
  try {
    const customer = await customerService.restoreCustomer({
      custNo: req.params.custNo,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Customer restored successfully',
      customer,
      ...customer,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
};
