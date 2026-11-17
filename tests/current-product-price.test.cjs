'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  PRODUCT_PRICES_AS_OF_SQL,
  assertTargetDate,
  listProductPricesAsOfSqlite,
} = require('../src/db/productPrices.cjs');

const root = path.resolve(__dirname, '..');

// Figure 11's P-* identifiers are not part of the approved historical seed.
// Construct isolated fixtures; never alter HopeERP.db or HOPE_Model1.db.
function createFigure11Database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(root, 'db/migrations/001_hope_base_tables.sql'), 'utf8'));

  const insertProduct = db.prepare(`
    INSERT INTO PRODUCT (prodCode, description, unit, status, stamp)
    VALUES (?, ?, 'Each', 'Active', 'TEST Figure 11')
  `);
  for (let i = 1; i <= 5; i += 1) {
    const code = `P-${String(i).padStart(3, '0')}`;
    insertProduct.run(code, `Figure 11 Product ${i}`);
  }

  const insertPrice = db.prepare(`
    INSERT INTO PRICEHIST (prodCode, effDate, unitPrice, status, stamp)
    VALUES (?, ?, ?, ?, 'TEST Figure 11')
  `);
  for (const row of [
    ['P-001', '2026-01-01', 0.60, 'Active'],
    ['P-001', '2026-06-15', 0.75, 'Active'],
    ['P-001', '2026-12-01', 9.99, 'Active'],
    ['P-002', '2026-01-01', 0.50, 'Active'],
    ['P-002', '2026-09-01', 1.50, 'Inactive'],
    ['P-003', '2026-05-01', 0.00, 'Active'],
    ['P-005', '2026-01-01', 0.20, 'Active'],
    ['P-005', '2026-09-30', 0.35, 'Active'],
  ]) {
    insertPrice.run(...row);
  }
  return db;
}

function withFixture(fn) {
  const db = createFigure11Database();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

test('Figure 11: all five products return the required prices as of the specified date', () => {
  withFixture((db) => {
    const results = listProductPricesAsOfSqlite(db, '2026-10-15');
    assert.equal(results.length, 5);
    assert.deepEqual(
      Object.fromEntries(results.map(({ prodCode, currentPrice }) => [prodCode, currentPrice])),
      { 'P-001': 0.75, 'P-002': 0.50, 'P-003': 0, 'P-004': null, 'P-005': 0.35 }
    );
    assert.deepEqual(Object.keys(results[0]), [
      'prodCode', 'description', 'unit', 'status', 'stamp', 'currentPrice',
    ]);
    assert.equal(results[2].currentPrice, 0, 'Zero is a valid price, not NULL');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  });
});

test('A future-dated Active price is ignored until its effective date', () => {
  withFixture((db) => {
    assert.equal(listProductPricesAsOfSqlite(db, '2026-11-30')[0].currentPrice, 0.75);
    assert.equal(listProductPricesAsOfSqlite(db, '2026-12-01')[0].currentPrice, 9.99);
    assert.equal(listProductPricesAsOfSqlite(db, '2026-06-14')[0].currentPrice, 0.60);
  });
});

test('A newer Inactive price is skipped; an older Active price wins', () => {
  withFixture((db) => {
    const priceOfP002 = () => listProductPricesAsOfSqlite(db, '2026-10-15')[1].currentPrice;
    assert.equal(priceOfP002(), 0.50);
    db.prepare("UPDATE PRICEHIST SET status='Active' WHERE prodCode='P-002' AND effDate='2026-09-01'").run();
    assert.equal(priceOfP002(), 1.50);
    db.prepare("UPDATE PRICEHIST SET status='Inactive' WHERE prodCode='P-002' AND effDate='2026-09-01'").run();
    assert.equal(priceOfP002(), 0.50);
  });
});

test('No price, only future prices, or only inactive past prices all yield NULL', () => {
  withFixture((db) => {
    const priceOfP004 = () => listProductPricesAsOfSqlite(db, '2026-10-15')[3].currentPrice;
    assert.equal(priceOfP004(), null);
    db.prepare(`INSERT INTO PRICEHIST (prodCode,effDate,unitPrice,stamp)
                VALUES ('P-004','2026-12-01',1.25,'TEST')`).run();
    assert.equal(priceOfP004(), null);
    db.prepare(`INSERT INTO PRICEHIST (prodCode,effDate,unitPrice,status,stamp)
                VALUES ('P-004','2026-02-01',1.10,'Inactive','TEST')`).run();
    assert.equal(priceOfP004(), null);
  });
});

test('Target date is a bound parameter and invalid/injected dates are rejected', () => {
  assert.match(PRODUCT_PRICES_AS_OF_SQL, /ph\.effDate\s*<=\s*\?/);
  assert.doesNotMatch(PRODUCT_PRICES_AS_OF_SQL, /CURRENT_DATE|date\s*\(\s*'now'/i);
  assert.equal(assertTargetDate('2024-02-29'), '2024-02-29');
  for (const bad of [null, undefined, '', '2026-02-30', '2026-2-01', '0000-01-01',
    "2026-10-15' OR 1=1 --", '2026-10-15; DROP TABLE PRODUCT;']) {
    assert.throws(() => assertTargetDate(bad), /valid YYYY-MM-DD/);
  }
  withFixture((db) => {
    assert.throws(() => listProductPricesAsOfSqlite(db, "2026-10-15' OR 1=1 --"), /valid YYYY-MM-DD/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM PRODUCT').get().count, 5);
  });
});

test('SQLite lookup uses the existing composite PK index; PostgreSQL function is invoker-only', () => {
  withFixture((db) => {
    const plan = db.prepare('EXPLAIN QUERY PLAN ' + PRODUCT_PRICES_AS_OF_SQL).all('2026-10-15')
      .map((row) => row.detail).join(' | ');
    assert.match(plan, /SEARCH ph USING INDEX sqlite_autoindex_PRICEHIST_1/);
    assert.match(plan, /CORRELATED SCALAR SUBQUERY/);
  });
  const postgres = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261117_006_product_prices_as_of.sql'), 'utf8'
  );
  assert.match(postgres, /SECURITY INVOKER/i);
  assert.match(postgres, /ph\."effDate"\s*<=\s*p_target_date/);
  assert.match(postgres, /ph\."status"\s*=\s*'Active'/);
  assert.match(postgres, /ORDER BY ph\."effDate" DESC\s+LIMIT 1/);
  assert.match(postgres, /REVOKE ALL ON FUNCTION .* FROM PUBLIC, anon, authenticated/);
});
