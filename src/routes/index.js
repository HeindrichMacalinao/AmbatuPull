'use strict';

const express = require('express');
const { getHealth } = require('../controllers/healthController');
const authRouter = require('./auth');
const usersRouter = require('./users');
const navigationRouter = require('./navigation');
const dashboardRouter = require('./dashboard');
const customersRouter = require('./customers');

const router = express.Router();

router.get('/health', getHealth);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/navigation', navigationRouter);
router.use('/dashboard', dashboardRouter);
router.use('/customers', customersRouter);

module.exports = router;
