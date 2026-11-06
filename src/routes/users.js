'use strict';

const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleBlock,
  updateRole,
} = require('../controllers/userController');
const {
  authenticate,
  requireAdminOrSuperadmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Enforce authentication & role requirements on user management endpoints
router.use(authenticate);
router.use(requireAdminOrSuperadmin);

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.put('/:id/block', toggleBlock);
router.put('/:id/role', updateRole);

module.exports = router;
