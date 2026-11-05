'use strict';

const express = require('express');
const {
  login,
  logout,
  registerUser,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', registerUser);

// Password recovery flow (S1-DEV-04)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Aliases for QA contract suite compatibility
router.post('/password-reset/request', forgotPassword);
router.post('/password-reset/complete', resetPassword);

module.exports = router;
