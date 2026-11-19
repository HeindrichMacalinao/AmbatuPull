'use strict';

const productService = require('../services/productService');

/**
 * GET /api/products
 */
async function getProducts(req, res, next) {
  try {
    const products = await productService.listProducts({
      requester: req.user,
      search: req.query.search,
      status: req.query.status,
    });
    res.status(200).json({ products, total: products.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:prodCode
 */
async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductByCode({
      prodCode: req.params.prodCode,
      requester: req.user,
    });
    res.status(200).json({ product, ...product });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProducts,
  getProduct,
};
