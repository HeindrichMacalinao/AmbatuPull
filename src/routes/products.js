'use strict';

const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
} = require('../controllers/productController');
const {
  authenticate,
  requireProductAccess,
  requireRight,
  requireAdminOrSuperadmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireProductAccess);

router.get('/', getProducts);
router.get('/:prodCode', getProduct);
router.post('/', requireRight('product.add'), createProduct);
router.put('/:prodCode', requireRight('product.edit'), updateProduct);
router.delete('/:prodCode', requireRight('product.delete'), deleteProduct);
router.put('/:prodCode/restore', requireAdminOrSuperadmin, restoreProduct);

module.exports = router;
