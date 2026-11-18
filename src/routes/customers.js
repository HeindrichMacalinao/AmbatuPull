'use strict';

const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  restoreCustomer,
} = require('../controllers/customerController');
const {
  authenticate,
  requireCustomerAccess,
  requireRight,
  requireAdminOrSuperadmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireCustomerAccess);

router.get('/', getCustomers);
router.get('/:custNo', getCustomer);
router.post('/', requireRight('customer.add'), createCustomer);
router.put('/:custNo', requireRight('customer.edit'), updateCustomer);
router.delete('/:custNo', requireRight('customer.delete'), deleteCustomer);
router.put('/:custNo/restore', requireAdminOrSuperadmin, restoreCustomer);

module.exports = router;
