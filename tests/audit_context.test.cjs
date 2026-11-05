'use strict';

// Node 22+ built-in runner for the SQLite audit connection integration.
// No npm packages, HTTP server, or external services required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  withAuditUser, currentAuditUser, registerAuditUser, auditMiddleware,
} = require('../src/db/audit-context.cjs');

const root = path.resolve(__dirname, '..');
const sqlFiles = [
  'db/migrations/001_hope_base_tables.sql',
  'db/seeds/002_hope_historical_data.sql',
  'db/migrations/002_user_management_tables.sql',
  'db/migrations/003_password_reset_token.sql',
  'db/seeds/003_initial_access_catalog.sql',
  'db/migrations/004_audit_trail.sql',
];

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  for (const file of sqlFiles) {
    db.exec(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  registerAuditUser(db);
  db.exec('PRAGMA recursive_triggers = ON');
  return db;
}

test('actor is mandatory and isolated by AsyncLocalStorage', async () => {
  assert.throws(() => currentAuditUser(), /no audit actor/);
  assert.throws(() => withAuditUser('spoof\nactor', () => null), /trusted identifier/);
  const calls = ['operator-one', 'operator-two'].map(actor =>
    withAuditUser(actor, async () => {
      await Promise.resolve();
      assert.equal(currentAuditUser(), actor);
      await new Promise(setImmediate);
      return currentAuditUser();
    }));
  assert.deepEqual(await Promise.all(calls), ['operator-one', 'operator-two']);
  assert.throws(() => currentAuditUser(), /no audit actor/);
});

test('SQL trigger stamps and logs rights changes using trusted actor', () => {
  const db = freshDatabase();
  try {
    const insert = db.prepare(`INSERT INTO app_user
      (firstName,lastName,email,passwordHash,stamp)
      VALUES ('Test','Runner','node-audit@example.invalid','DO_NOT_LOG_ME','PENDING')`);
    assert.throws(() => insert.run(), /no audit actor|user-defined function|SQL logic error/);
    withAuditUser('node-test-42', () => {
      insert.run();
      const uid = db.prepare('SELECT userId FROM app_user').get().userId;
      db.prepare('INSERT INTO user_permission(userId,rightCode,stamp) VALUES (?,?,?)')
        .run(uid, 'customer.add', 'PENDING');
      const stamp = db.prepare('SELECT stamp FROM user_permission WHERE userId=?').get(uid).stamp;
      assert.match(stamp, /^RIGHTS_UPDATED node-test-42 \d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
      db.prepare("UPDATE user_permission SET status='Inactive' WHERE userId=?").run(uid);
      const rows = db.prepare("SELECT performedBy,action,details FROM audit_log WHERE tableName='user_permission' ORDER BY id").all();
      assert.equal(rows.length, 2);
      assert(rows.every(row => row.performedBy === 'node-test-42' && row.action === 'RIGHTS_UPDATED'));
      assert.equal(JSON.parse(rows[1].details).before.status, 'Active');
      assert.equal(JSON.parse(rows[1].details).after.status, 'Inactive');
      assert(!JSON.stringify(rows).includes('DO_NOT_LOG_ME'));
      assert.throws(() => db.exec('DELETE FROM audit_log'), /append-only/);
    });
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    db.close();
  }
});

test('middleware uses authenticated identity, never user-submitted headers', () => {
  const middleware = auditMiddleware();
  const db = freshDatabase();
  try {
    let nextCalled = false;
    const response = { status(code) { this.code=code; return this; }, json(body) { this.body=body; } };
    middleware({ headers: { 'x-user-id': 'attacker' }, body: { actor: 'attacker' } }, response,
      () => { nextCalled = true; });
    assert.equal(response.code, 401);
    assert.equal(nextCalled, false);
    middleware({ user: { id: 'trusted-id' }, headers: { 'x-user-id': 'attacker' } }, response, () => {
      assert.equal(currentAuditUser(), 'trusted-id');
      db.exec("UPDATE rights SET description='Audited adjustment' WHERE rightCode='customer.add'");
    });
    assert.equal(db.prepare("SELECT performedBy FROM audit_log WHERE tableName='rights'").get().performedBy, 'trusted-id');
  } finally { db.close(); }
});
