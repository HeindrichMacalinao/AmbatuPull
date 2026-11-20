'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test, beforeEach, afterEach } = require('node:test');
const poolModule = require('../src/db/pool');
const productService = require('../src/services/productService');
const {
  listProductPricesAsOfSqlite,
} = require('../src/db/productPrices.cjs');

const root = path.resolve(__dirname, '..');
const admin = { role: 'Admin', email: 'admin@hope.com' };
const user = { role: 'User', userId: 7, email: 'user@hope.com', rights: ['price.view'] };

function createPriceFixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(root, 'db/migrations/001_hope_base_tables.sql'), 'utf8'));
  const product = db.prepare(`
    INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
    VALUES (?, ?, 'Each', 'Active', 'TEST S2-TST-02')
  `);
  for (const code of ['P-001', 'P-002', 'P-003', 'P-004']) {
    product.run(code, `Fixture ${code}`);
  }
  const price = db.prepare(`
    INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
    VALUES (?, ?, ?, 'Active', 'TEST S2-TST-02')
  `);
  price.run('P-003', '2026-05-01', 10);
  price.run('P-003', '2026-10-01', 12.5);
  price.run('P-003', '2026-12-01', 99);
  return db;
}

test('TC-PROD-01/02/03: current price uses the latest eligible date and leaves P-004 null', () => {
  const db = createPriceFixture();
  try {
    const beforeFuturePrice = listProductPricesAsOfSqlite(db, '2026-11-30');
    assert.equal(beforeFuturePrice.find((p) => p.prodCode === 'P-003').currentPrice, 12.5);
    assert.equal(beforeFuturePrice.find((p) => p.prodCode === 'P-004').currentPrice, null);

    const onFutureDate = listProductPricesAsOfSqlite(db, '2026-12-01');
    assert.equal(onFutureDate.find((p) => p.prodCode === 'P-003').currentPrice, 99);
  } finally {
    db.close();
  }
});

let originalGetPool;
let queryHandler;

const fakePool = {
  query: async (sql, params = []) => {
    if (queryHandler) return queryHandler(sql, params);
    return { rows: [], rowCount: 0 };
  },
};

beforeEach(() => {
  originalGetPool = poolModule.getPool;
  poolModule.getPool = () => fakePool;
  queryHandler = null;
});

afterEach(() => {
  poolModule.getPool = originalGetPool;
});

test('TC-PRICE-01/03: P-003 history is newest-first and role fields are restricted', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) return { rows: [{ 1: 1 }], rowCount: 1 };
    if (sql.includes('FROM PRICEHIST')) {
      assert.match(sql, /ORDER BY effDate DESC/);
      return {
        rows: [
          { prodCode: 'P-003', effDate: '2026-10-01', unitPrice: '12.50', status: 'Active', stamp: 'CREATED admin' },
          { prodCode: 'P-003', effDate: '2026-05-01', unitPrice: '10.00', status: 'Inactive', stamp: 'DELETED admin' },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const adminPrices = await productService.listPrices({ prodCode: 'P-003', requester: admin });
  assert.deepEqual(adminPrices.map((price) => price.effDate), ['2026-10-01', '2026-05-01']);
  assert.equal(adminPrices[0].status, 'Active');
  assert.equal(adminPrices[0].stamp, 'CREATED admin');

  const userPrices = await productService.listPrices({ prodCode: 'P-003', requester: user });
  assert.equal('status' in userPrices[0], false);
  assert.equal('stamp' in userPrices[0], false);
});

test('TC-PRICE-02: duplicate product/effective-date price is rejected', async () => {
  queryHandler = async (sql) => {
    if (sql.includes('SELECT 1 FROM PRODUCT')) return { rows: [{ 1: 1 }], rowCount: 1 };
    if (sql.includes('FROM PRICEHIST')) return { rows: [{ 1: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };

  await assert.rejects(
    () => productService.addPrice({
      prodCode: 'P-003',
      effDate: '2026-10-01',
      unitPrice: 20,
      requester: admin,
    }),
    (error) => error.status === 400 &&
      error.message.includes('already exists for this effective date')
  );
});
