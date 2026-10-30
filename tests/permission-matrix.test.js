'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const RIGHTS = [
  'customer.view', 'customer.create', 'customer.delete',
  'product.view', 'product.create', 'product.edit', 'product.delete',
  'product.import', 'product.export',
  'hr.view', 'hr.create', 'hr.edit', 'hr.delete', 'hr.block', 'hr.roles',
  'hr.rights', 'hr.attendance', 'hr.leave', 'hr.payroll', 'hr.documents',
  'hr.export', 'hr.audit',
  'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.refund',
  'sales.export', 'sales.discount',
  'reports.view', 'reports.sales', 'reports.inventory', 'reports.hr',
  'reports.financial', 'reports.export', 'reports.audit',
];

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');
const password = process.env.AUTH_TEST_PASSWORD || 'QaPassword!123';
const account = {
  email: process.env.AUTH_TEST_EMAIL || 'test_user@hope.com',
  password,
};

function skipWithoutServer(t) {
  if (!baseUrl) {
    t.skip('Set BASE_URL to execute HTTP permission-matrix contract tests');
    return true;
  }
  return false;
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function login() {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(account),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie');
}

function endpointFor(right) {
  const [module, action] = right.split('.');
  return `/api/${module}/${action}`;
}

test('permission catalogue contains 36 unique rights', () => {
  assert.equal(RIGHTS.length, 36);
  assert.equal(new Set(RIGHTS).size, RIGHTS.length);
});

test('each granted right allows and each revoked right rejects its direct API call', async (t) => {
  if (skipWithoutServer(t)) return;
  const cookie = await login();

  for (const right of RIGHTS) {
    const grant = await request('/api/permissions/test_user@hope.com', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ right, enabled: true }),
    });
    assert.ok([200, 204].includes(grant.status), `grant failed: ${right}`);

    const allowed = await request(endpointFor(right), { headers: { cookie } });
    assert.ok(allowed.status >= 200 && allowed.status < 300, `allow failed: ${right}`);

    const revoke = await request('/api/permissions/test_user@hope.com', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ right, enabled: false }),
    });
    assert.ok([200, 204].includes(revoke.status), `revoke failed: ${right}`);

    const denied = await request(endpointFor(right), { headers: { cookie } });
    assert.equal(denied.status, 403, `deny failed: ${right}`);
  }
});

test('All and None shortcuts persist the complete matrix', async (t) => {
  if (skipWithoutServer(t)) return;
  const cookie = await login();
  for (const [shortcut, expected] of [['all', 36], ['none', 0]]) {
    const response = await request('/api/permissions/test_user@hope.com/bulk', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ shortcut }),
    });
    assert.ok([200, 204].includes(response.status));
    const persisted = await request('/api/permissions/test_user@hope.com', {
      headers: { cookie },
    });
    assert.equal((await persisted.json()).rights.length, expected);
  }
});

test('revoking customer.delete is enforced server-side and audited', async (t) => {
  if (skipWithoutServer(t)) return;
  const cookie = await login();
  const response = await request('/api/permissions/test_user@hope.com', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ right: 'customer.delete', enabled: false }),
  });
  assert.ok([200, 204].includes(response.status));

  const denied = await request('/api/customer/delete', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ id: 'fixture-customer' }),
  });
  assert.equal(denied.status, 403);

  const audit = await request('/api/audit?target=test_user@hope.com&right=customer.delete', {
    headers: { cookie },
  });
  assert.equal(audit.status, 200);
  assert.match(JSON.stringify(await audit.json()), /revoke|actor|timestamp/i);
});

