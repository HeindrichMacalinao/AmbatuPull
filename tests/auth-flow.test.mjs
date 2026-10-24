import { test } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL?.replace(/\/$/, '');

async function request(path, options = {}) {
  if (!baseUrl) return null;
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
}

test('authentication contract: duplicate registration is rejected', async (t) => {
  if (!baseUrl) return t.skip('Set BASE_URL to run HTTP authentication tests');
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'qa.user@hope.com', password: 'QaPassword!123' }),
  });
  assert.equal(response.status, 409);
});

test('authentication contract: blocked accounts cannot log in', async (t) => {
  if (!baseUrl) return t.skip('Set BASE_URL to run HTTP authentication tests');
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'qa.blocked@hope.com', password: 'QaPassword!123' }),
  });
  assert.equal(response.status, 403);
  assert.match(await response.text(), /blocked/i);
});
