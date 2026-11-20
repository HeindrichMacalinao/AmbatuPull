'use strict';

const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
} = require('../controllers/productController');
const {
  authenticate,
  requireProductAccess,
  requireRight,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireProductAccess);

router.get('/', getProducts);
router.get('/:prodCode', getProduct);
router.post('/', requireRight('product.add'), createProduct);
router.put('/:prodCode', requireRight('product.edit'), updateProduct);

module.exports = router;
