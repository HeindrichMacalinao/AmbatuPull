'use strict';

const express = require('express');
const { getHealth } = require('../controllers/healthController');
const authRouter = require('./auth');
const usersRouter = require('./users');
const navigationRouter = require('./navigation');
const dashboardRouter = require('./dashboard');
const customersRouter = require('./customers');
const productsRouter = require('./products');
const hrRouter = require('./hr');

const router = express.Router();

router.get('/health', getHealth);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/navigation', navigationRouter);
router.use('/dashboard', dashboardRouter);
router.use('/customers', customersRouter);
router.use('/products', productsRouter);
router.use('/hr', hrRouter);
router.use('/jobs', hrRouter.jobsRouter);

module.exports = router;
