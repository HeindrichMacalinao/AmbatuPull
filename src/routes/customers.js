'use strict';

const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
} = require('../controllers/customerController');
const {
  authenticate,
  requireCustomerAccess,
  requireRight,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireCustomerAccess);

router.get('/', getCustomers);
router.get('/:custNo', getCustomer);
router.post('/', requireRight('customer.add'), createCustomer);
router.put('/:custNo', requireRight('customer.edit'), updateCustomer);

module.exports = router;
