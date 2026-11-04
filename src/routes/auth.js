'use strict';

const express = require('express');
const { login, logout, registerUser } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', registerUser);

module.exports = router;
