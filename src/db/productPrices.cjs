'use strict';

// S2-DBA-02 (#101): parameterized effective-date lookup for SQLite.
// DATE values in the project SQLite schema are stored as ISO YYYY-MM-DD text.
// Never interpolate the caller's target date into this query.
const PRODUCT_PRICES_AS_OF_SQL = `
SELECT p.prodCode, p.description, p.unit, p.status, p.stamp,
       (SELECT ph.unitPrice
        FROM PRICEHIST AS ph
        WHERE ph.prodCode = p.prodCode
          AND ph.effDate <= ?
          AND ph.status = 'Active'
        ORDER BY ph.effDate DESC
        LIMIT 1) AS currentPrice
FROM PRODUCT AS p
ORDER BY p.prodCode;
`;

function assertTargetDate(targetDate) {
  if (typeof targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new RangeError('targetDate must be a valid YYYY-MM-DD date');
  }
  const parsed = new Date(`${targetDate}T00:00:00Z`);
  if (
    Number(targetDate.slice(0, 4)) === 0 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== targetDate
  ) {
    throw new RangeError('targetDate must be a valid YYYY-MM-DD date');
  }
  return targetDate;
}

function listProductPricesAsOfSqlite(db, targetDate) {
  const asOf = assertTargetDate(targetDate);
  return db.prepare(PRODUCT_PRICES_AS_OF_SQL).all(asOf);
}

module.exports = { PRODUCT_PRICES_AS_OF_SQL, assertTargetDate, listProductPricesAsOfSqlite };
