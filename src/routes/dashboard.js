'use strict';

const express = require('express');
const { getDashboardMetrics } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/metrics', getDashboardMetrics);
router.get('/', getDashboardMetrics);

module.exports = router;
