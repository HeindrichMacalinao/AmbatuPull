'use strict';

const express = require('express');
const {
  login,
  logout,
  registerUser,
  forgotPassword,
  resetPassword,
  getSession,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', registerUser);

// Session endpoints (§3.8, S2-DEV-08)
router.get('/session', authenticate, getSession);
router.get('/me', authenticate, getSession);

// Password recovery flow (S1-DEV-04)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Aliases for QA contract suite compatibility
router.post('/password-reset/request', forgotPassword);
router.post('/password-reset/complete', resetPassword);

module.exports = router;
