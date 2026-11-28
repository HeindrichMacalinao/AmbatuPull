-- [S4-DBA-01] Sales Transaction Totals & Historical Line Pricing Views (SQLite)
-- Note: SQLite stores DECIMAL(10,2) with NUMERIC affinity; ROUND(..., 2) avoids IEEE-754 float drift.
BEGIN;

DROP VIEW IF EXISTS v_sales_summary;
DROP VIEW IF EXISTS v_saleline;

CREATE VIEW v_saleline AS
SELECT
    sd.transNo,
    s.salesDate,
    sd.prodCode,
    sd.quantity,
    ph.unitPrice,
    CASE
        WHEN ph.unitPrice IS NULL THEN NULL
        ELSE ROUND(sd.quantity * ph.unitPrice, 2)
    END AS lineTotal,
    ph.effDate AS priceEffDate,
    CASE
        WHEN ph.unitPrice IS NULL THEN 1
        ELSE 0
    END AS isMissingPrice,
    sd.status,
    sd.stamp
FROM SALESDETAIL sd
JOIN SALES s
    ON sd.transNo = s.transNo
LEFT JOIN PRICEHIST ph
    ON ph.prodCode = sd.prodCode
   AND ph.status = 'Active'
   AND ph.effDate = (
       SELECT ph2.effDate
       FROM PRICEHIST ph2
       WHERE ph2.prodCode = sd.prodCode
         AND ph2.status = 'Active'
         AND ph2.effDate <= s.salesDate
       ORDER BY ph2.effDate DESC
       LIMIT 1
   );

CREATE VIEW v_sales_summary AS
SELECT
    s.transNo,
    s.salesDate,
    s.custNo,
    COUNT(l.prodCode) AS totalLines,
    COALESCE(SUM(CASE WHEN l.prodCode IS NOT NULL AND l.unitPrice IS NULL THEN 1 ELSE 0 END), 0) AS missingPriceCount,
    CASE
        WHEN COALESCE(SUM(CASE WHEN l.prodCode IS NOT NULL AND l.unitPrice IS NULL THEN 1 ELSE 0 END), 0) > 0 THEN 1
        ELSE 0
    END AS hasMissingPrice,
    ROUND(COALESCE(SUM(l.lineTotal), 0), 2) AS transactionTotal,
    s.status,
    s.stamp
FROM SALES s
LEFT JOIN v_saleline l
    ON s.transNo = l.transNo
   AND l.status = 'Active'
WHERE s.status = 'Active'
GROUP BY
    s.transNo,
    s.salesDate,
    s.custNo,
    s.status,
    s.stamp;

COMMIT;
