'use strict';

const express = require('express');
const { getHealth } = require('../controllers/healthController');
const authRouter = require('./auth');

const router = express.Router();

router.get('/health', getHealth);
router.use('/auth', authRouter);

module.exports = router;
