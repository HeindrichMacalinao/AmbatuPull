#!/usr/bin/env python3
"""S2-DBA-03: read-only audit of rows incompatible with proposed domain rules.

Usage: python scripts/check_domain_constraint_readiness.py [path/to/database.db]
Exit 2 means manual cleanup approval is needed before full validation.
Never changes records or constraints; Supabase must be audited separately.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def audit(connection: sqlite3.Connection) -> dict[str, int]:
    """Audit existing data, not the validity of future INSERT/UPDATE triggers."""
    checks = {
        'customer_payterms': (
            "SELECT COUNT(*) FROM CUSTOMER WHERE payTerms IS NOT NULL "
            "AND payTerms NOT IN ('Net 15','Net 30','Net 45','COD','Prepaid')"
        ),
        'customer_custno': (
            'SELECT COUNT(*) FROM CUSTOMER WHERE custNo IS NULL OR length(custNo)>10 '
            "OR length(trim(custNo))=0"
        ),
        'customer_custname': (
            'SELECT COUNT(*) FROM CUSTOMER WHERE custName IS NULL OR length(trim(custName))=0'
        ),
        'product_unit': (
            "SELECT COUNT(*) FROM PRODUCT WHERE unit IS NOT NULL "
            "AND unit NOT IN ('pcs','can','pair','meter','box','kg','set')"
        ),
        'pricehist_unitprice': (
            'SELECT COUNT(*) FROM PRICEHIST WHERE unitPrice IS NULL '
            "OR typeof(unitPrice) NOT IN ('integer','real') OR unitPrice<=0"
        ),
        'pricehist_duplicates': (
            'SELECT COUNT(*) FROM (SELECT prodCode,effDate FROM PRICEHIST '
            'GROUP BY prodCode,effDate HAVING COUNT(*)>1)'
        ),
    }
    for table in ('CUSTOMER', 'PRODUCT', 'PRICEHIST'):
        checks[f'{table.lower()}_status'] = (
            f"SELECT COUNT(*) FROM {table} WHERE status IS NULL "
            "OR status NOT IN ('Active','Inactive')"
        )
    return {name: connection.execute(sql).fetchone()[0] for name, sql in checks.items()}


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'HopeERP.db'
    if not path.is_file():
        print(f'Database not found: {path}', file=sys.stderr)
        return 1
    connection = sqlite3.connect(f'file:{path.resolve().as_posix()}?mode=ro', uri=True)
    try:
        violations = audit(connection)
        print(f'S2-DBA-03 preflight (read-only): {path}')
        for name, count in violations.items():
            print(f'  {name}: {count}')
        if violations['customer_payterms']:
            print('  legacy payTerms distribution:', connection.execute(
                'SELECT payTerms,COUNT(*) FROM CUSTOMER GROUP BY payTerms ORDER BY payTerms'
            ).fetchall())
        if violations['product_unit']:
            print('  legacy unit distribution:', connection.execute(
                'SELECT unit,COUNT(*) FROM PRODUCT GROUP BY unit ORDER BY unit'
            ).fetchall())
    finally:
        connection.close()
    if any(violations.values()):
        print('ACTION REQUIRED: approve cleanup mappings before validating old rows.')
        return 2
    print('PASS: existing rows satisfy the proposed domain constraints.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
