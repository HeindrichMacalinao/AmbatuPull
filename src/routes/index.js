'use strict';

const express = require('express');
const { getHealth } = require('../controllers/healthController');
const authRouter = require('./auth');
const usersRouter = require('./users');

const router = express.Router();

router.get('/health', getHealth);
router.use('/auth', authRouter);
router.use('/users', usersRouter);

module.exports = router;
