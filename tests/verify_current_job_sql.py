#!/usr/bin/env python3
"""S3-DBA-02 SQL verification on disposable SQLite schemas, no production writes."""
from __future__ import annotations
import sqlite3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]


def check_variant(core: str, query: str, has_dept: bool) -> None:
    cx = sqlite3.connect(':memory:')
    cx.execute('PRAGMA foreign_keys=ON')
    try:
        cx.executescript((ROOT / core).read_text())
        cx.execute("INSERT INTO JOB(jobCode,jobDesc,status,stamp) VALUES('J-1','Analyst','Active','TEST')")
        cx.execute("INSERT INTO DEPARTMENT(deptCode,deptName,status,stamp) VALUES('D-1','Operations','Active','TEST')")
        cx.execute("INSERT INTO EMPLOYEE(empNo,lastName,firstName,hireDate,status,stamp) "
                   "VALUES('E-1','Example','Test','2026-01-01','Active','TEST')")
        if has_dept:
            cx.execute("INSERT INTO JOBHISTORY(empNo,jobCode,deptCode,effDate,salary,status,stamp) "
                       "VALUES('E-1','J-1','D-1','2026-02-01',100,'Active','TEST')")
        else:
            cx.execute("INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,status,stamp) "
                       "VALUES('E-1','J-1','2026-02-01',100,'Active','TEST')")
        sql = (ROOT / query).read_text()
        if query.endswith('verify_current_job.sql'):
            select_sql = sql.split(';', 1)[0]
            plan_sql = 'EXPLAIN QUERY PLAN' + sql.split('EXPLAIN QUERY PLAN', 1)[1]
            plan_rows = cx.execute(plan_sql, {'empNo': 'E-1', 'asOfDate': '2026-03-01'}).fetchall()
            assert plan_rows
        else:
            select_sql = sql.split(';', 1)[0]
        params = {'empNo': 'E-1', 'asOfDate': '2026-03-01'}
        row = cx.execute(select_sql, params).fetchone()
        assert row is not None
        assert row[0] == 'E-1' and row[1] == 'J-1' and row[2] == 'Analyst'
        assert row[3] == ('D-1' if has_dept else None)
        assert row[4] == ('Operations' if has_dept else None)
        assert row[5] == 100 and row[6] == '2026-02-01'
        row = cx.execute(select_sql, {'empNo': 'E-1', 'asOfDate': '2026-01-01'}).fetchone()
        assert row == ('E-1', None, None, None, None, None, None)
        assert cx.execute('PRAGMA foreign_key_check').fetchall() == []
        print(f'PASS: {query} (parameterized SQL, history and no-history cases)')
    finally:
        cx.close()


def check_historical_assets() -> None:
    for file in ('HopeERP.db','HOPE_Model1.db'):
        dbpath = ROOT / file
        if not dbpath.exists():
            continue
        db = sqlite3.connect(f'file:{dbpath}?mode=ro', uri=True)
        try:
            has_dept = 'deptCode' in {r[1] for r in db.execute('PRAGMA table_info(JOBHISTORY)')}
            query_path = 'db/verify/verify_current_job.sql' if has_dept else 'db/verify/verify_current_job_historical.sql'
            sql = (ROOT / query_path).read_text().split(';', 1)[0]
            example = db.execute("SELECT empNo FROM EMPLOYEE WHERE status='Active' LIMIT 1").fetchone()
            if example:
                row = db.execute(sql, {'empNo':example[0], 'asOfDate':'2026-11-26'}).fetchone()
                assert row is not None and row[0] == example[0]
                if not has_dept:
                    assert row[3] is None
            print(f'PASS: {file} opened read-only')
        finally:
            db.close()


if __name__ == '__main__':
    print(f'SQLite version {sqlite3.sqlite_version}; all fixtures in-memory')
    check_variant('migrations/001_init_core_schema.sql', 'db/verify/verify_current_job.sql', True)
    check_variant('db/migrations/001_hope_base_tables.sql',
                  'db/verify/verify_current_job_historical.sql', False)
    check_historical_assets()
    print('ALL S3-DBA-02 SQL VERIFICATIONS PASSED')
