'use strict';

const express = require('express');
const { getNavigation } = require('../controllers/navigationController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', getNavigation);

module.exports = router;
