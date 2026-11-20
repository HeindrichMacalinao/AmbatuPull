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

/**
 * POST /api/products (Create Product)
 */
async function createProduct(req, res, next) {
  try {
    const product = await productService.createProduct({
      data: req.body,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Product created successfully',
      product,
      ...product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:prodCode (Edit Product)
 */
async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct({
      prodCode: req.params.prodCode,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Product updated successfully',
      product,
      ...product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/products/:prodCode (Soft Delete Product)
 */
async function deleteProduct(req, res, next) {
  try {
    const product = await productService.softDeleteProduct({
      prodCode: req.params.prodCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Product deleted successfully',
      product,
      ...product,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:prodCode/restore (Restore Product)
 */
async function restoreProduct(req, res, next) {
  try {
    const product = await productService.restoreProduct({
      prodCode: req.params.prodCode,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Product restored successfully',
      product,
      ...product,
    });
  } catch (err) {
    next(err);
  }
}


/**
 * GET /api/products/:prodCode/prices
 */
async function getProductPrices(req, res, next) {
  try {
    const prices = await productService.listPrices({
      prodCode: req.params.prodCode,
      requester: req.user,
      status: req.query.status,
    });
    res.status(200).json({ prices, total: prices.length });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products/:prodCode/prices (Add Price)
 */
async function addPrice(req, res, next) {
  try {
    const price = await productService.addPrice({
      prodCode: req.params.prodCode,
      effDate: req.body.effDate,
      unitPrice: req.body.unitPrice,
      requester: req.user,
    });
    res.status(201).json({
      message: 'Price record created successfully',
      price,
      ...price,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:prodCode/prices/:effDate (Edit Price)
 */
async function updatePrice(req, res, next) {
  try {
    const price = await productService.updatePrice({
      prodCode: req.params.prodCode,
      effDate: req.params.effDate,
      unitPrice: req.body.unitPrice,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Price record updated successfully',
      price,
      ...price,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/products/:prodCode/prices/:effDate (Delete Price)
 */
async function deletePrice(req, res, next) {
  try {
    const price = await productService.softDeletePrice({
      prodCode: req.params.prodCode,
      effDate: req.params.effDate,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Price record deleted successfully',
      price,
      ...price,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/products/:prodCode/prices/:effDate/restore (Restore Price)
 */
async function restorePrice(req, res, next) {
  try {
    const price = await productService.restorePrice({
      prodCode: req.params.prodCode,
      effDate: req.params.effDate,
      requester: req.user,
    });
    res.status(200).json({
      message: 'Price record restored successfully',
      price,
      ...price,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
