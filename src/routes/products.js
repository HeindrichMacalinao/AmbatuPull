'use strict';

const express = require('express');
const { getProducts, getProduct } = require('../controllers/productController');
const {
  authenticate,
  requireProductAccess,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireProductAccess);

router.get('/', getProducts);
router.get('/:prodCode', getProduct);

module.exports = router;
