'use strict';

// S1-DBA-06: per-request SQLite audit actor (no new npm dependencies).
// Register on EVERY writable SQLite connection before running mutations.
// Compatible with better-sqlite3 and Node's DatabaseSync .function() API.
// The caller MUST derive actor from a verified identity, never headers/body.
const { AsyncLocalStorage } = require('node:async_hooks');
const actorContext = new AsyncLocalStorage();
const VALID_ACTOR = /^[A-Za-z0-9][A-Za-z0-9_.@:-]{0,39}$/;

function validateActor(actor) {
  if (typeof actor !== 'string' || !VALID_ACTOR.test(actor)) {
    throw new TypeError('Audit actor must be a trusted identifier of 1–40 safe characters');
  }
  return actor;
}

function withAuditUser(actor, callback) {
  validateActor(actor);
  if (typeof callback !== 'function') {
    throw new TypeError('Audit callback must be a function');
  }
  return actorContext.run(actor, callback);
}

function currentAuditUser() {
  const actor = actorContext.getStore();
  if (!actor) {
    throw new Error('Unauthenticated SQLite write: no audit actor in context');
  }
  return actor;
}

function registerAuditUser(database) {
  if (!database || typeof database.function !== 'function') {
    throw new TypeError('SQLite driver must support database.function (better-sqlite3/DatabaseSync)');
  }
  // Do not set deterministic:true: the actor varies per request.
  database.function('audit_user', { deterministic: false }, currentAuditUser);
  // Must be enabled for every SQLite connection, not only during migration.
  if (typeof database.pragma === 'function') {
    database.pragma('foreign_keys = ON');
  } else if (typeof database.exec === 'function') {
    database.exec('PRAGMA foreign_keys = ON');
  }
  return database;
}

// Express middleware factory: INSTALL ONLY AFTER authenticated session
// middleware. Do not accept X-User, x-actor, or req.body.actor as identity.
// The default expects a validated req.user.id from existing authentication.
function auditMiddleware(getAuthenticatedActor = (req) => req.user?.id) {
  return (req, res, next) => {
    const identity = getAuthenticatedActor(req);
    if (identity === undefined || identity === null || identity === '') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    let actor;
    try {
      actor = validateActor(String(identity));
    } catch (error) {
      next(error);
      return;
    }
    actorContext.run(actor, next);
  };
}

module.exports = { validateActor, withAuditUser, currentAuditUser, registerAuditUser, auditMiddleware };
