'use strict';

const express = require('express');
const { getHealth } = require('../controllers/healthController');

const router = express.Router();

router.get('/health', getHealth);
const { registerUser } = require('../controllers/authController');
router.post('/auth/register', registerUser);

module.exports = router;
