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

module.exports = {
  getCustomers,
  getCustomer,
};
