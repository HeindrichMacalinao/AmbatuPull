'use strict';

const express = require('express');
const { getJobs } = require('../controllers/hrController');
const { authenticate, requireHrAccess } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(requireHrAccess);

// Jobs Lookup API (S3-DEV-01)
router.get('/jobs', getJobs);

module.exports = router;
