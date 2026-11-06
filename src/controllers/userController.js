'use strict';

const userService = require('../services/userService');

/**
 * GET /api/users
 */
async function getUsers(req, res, next) {
  try {
    const users = await userService.listUsers({ requester: req.user });
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id
 */
async function getUser(req, res, next) {
  try {
    const user = await userService.getUserById({ id: req.params.id, requester: req.user });
    res.status(200).json({ user, ...user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users
 */
async function createUser(req, res, next) {
  try {
    const user = await userService.createUser({ data: req.body, requester: req.user });
    res.status(201).json({ user, ...user });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id
 */
async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser({
      id: req.params.id,
      data: req.body,
      requester: req.user,
    });
    res.status(200).json({ user, ...user });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id/block
 */
async function toggleBlock(req, res, next) {
  try {
    const result = await userService.toggleUserBlock({
      id: req.params.id,
      requester: req.user,
      isBlocked: req.body ? req.body.isBlocked : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleBlock,
};
