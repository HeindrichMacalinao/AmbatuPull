'use strict';

const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  getProductPrices,
  addPrice,
  updatePrice,
  deletePrice,
  restorePrice,
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

// Price History Endpoints (§3.4 Figures 12 & 13, §3.8, S2-DEV-07)
router.get('/:prodCode/prices', getProductPrices);
router.post('/:prodCode/prices', requireRight('price.add'), addPrice);
router.put('/:prodCode/prices/:effDate', requireRight('price.edit'), updatePrice);
router.delete('/:prodCode/prices/:effDate', requireRight('price.delete'), deletePrice);
router.put('/:prodCode/prices/:effDate/restore', requireAdminOrSuperadmin, restorePrice);

// Product Detail & Mutation Endpoints
router.get('/:prodCode', getProduct);
router.post('/', requireRight('product.add'), createProduct);
router.put('/:prodCode', requireRight('product.edit'), updateProduct);
router.delete('/:prodCode', requireRight('product.delete'), deleteProduct);
router.put('/:prodCode/restore', requireAdminOrSuperadmin, restoreProduct);

module.exports = router;
