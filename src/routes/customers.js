'use strict';

const express = require('express');
const { getCustomers, getCustomer } = require('../controllers/customerController');
const { authenticate, requireCustomerAccess } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireCustomerAccess);

router.get('/', getCustomers);
router.get('/:custNo', getCustomer);

module.exports = router;
