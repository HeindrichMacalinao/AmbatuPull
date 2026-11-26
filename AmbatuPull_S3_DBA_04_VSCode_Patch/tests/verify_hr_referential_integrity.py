#!/usr/bin/env python3
"""S3-DBA-04: isolated SQLite trigger / FK verification, no project DB writes.

python3 -B tests/verify_hr_referential_integrity.py
"""
from __future__ import annotations

import sqlite3
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = {
    'trg_s3_hrri_job_delete', 'trg_s3_hrri_job_deactivate',
    'trg_s3_hrri_dept_delete', 'trg_s3_hrri_dept_deactivate',
    'trg_s3_hrri_employee_delete', 'trg_s3_hrri_employee_restore',
    'trg_s3_hrri_history_insert', 'trg_s3_hrri_history_update',
}


def execute(path: Path, db: sqlite3.Connection):
    db.executescript(path.read_text(encoding='utf-8'))


def assert_bad(db, sql, args=(), detail='S3-DBA-04'):
    db.execute('SAVEPOINT reject_test')
    try:
        try:
            db.execute(sql, args)
        except sqlite3.IntegrityError as exc:
            assert detail in str(exc), f'Wrong rejection: {exc}'
        else:
            raise AssertionError(f'Unexpected acceptance of {sql}')
    finally:
        db.execute('ROLLBACK TO SAVEPOINT reject_test')
        db.execute('RELEASE SAVEPOINT reject_test')


def assert_good(db, sql, args=()):
    db.execute('SAVEPOINT allow_test')
    try:
        db.execute(sql, args)
    finally:
        db.execute('ROLLBACK TO SAVEPOINT allow_test')
        db.execute('RELEASE SAVEPOINT allow_test')


def check_integrity(db):
    assert db.execute('PRAGMA foreign_keys').fetchone()[0] == 1
    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'


def setup_fixture(db, schema):
    for code, status in [('S4A','Active'),('S4B','Active'),('S4C','Inactive'),('S4H','Active'),('S4I','Active')]:
        db.execute('INSERT INTO JOB(jobCode,jobDesc,status,stamp) VALUES (?,?,?,?)',
                   (code, f'Fixture job {code}',status,'TEST'))
        db.execute('INSERT INTO DEPARTMENT(deptCode,deptName,status,stamp) VALUES (?,?,?,?)',
                   (code, f'Fixture department {code}', status,'TEST'))
    for emp, job, dept, status in [
        ('S4A','S4A','S4A','Active'),
        ('S4S',None,None,'Active'),
        ('S4N',None,None,'Active'),
        ('S4R','S4C','S4C','Inactive'),
        ('S4Q','S4A','S4A','Inactive'),
        ('S4H',None,None,'Inactive'),
        ('S4I','S4I','S4I','Inactive'),
    ]:
        if schema == 'runner':
            db.execute('INSERT INTO EMPLOYEE(empNo,lastName,firstName,hireDate,jobCode,deptCode,status,stamp) VALUES (?,?,?,?,?,?,?,?)',
                       (emp,'Tester','HR','2020-01-01',job,dept,status,'TEST'))
        else:
            db.execute('INSERT INTO EMPLOYEE(empNo,lastName,firstName,hireDate,status,stamp) VALUES (?,?,?,?,?,?)',
                       (emp,'Tester','HR','2020-01-01',status,'TEST'))
    for emp, job, dept, status in [
        ('S4A','S4A','S4A','Active'),
        ('S4R','S4C','S4C','Inactive'),
        ('S4Q','S4A','S4A','Active'),
        ('S4H','S4H','S4H','Inactive'),
        ('S4I','S4I','S4I','Active'),
    ]:
        db.execute('INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,deptCode,status,stamp) VALUES (?,?,?,?,?,?,?)',
                   (emp,job,'2020-02-01',100,dept,status,'TEST'))
    db.execute("INSERT INTO CUSTOMER(custNo,custName,payTerms,status,stamp) VALUES ('S4C','Fixture customer','COD','Active','TEST')")
    db.execute("INSERT INTO SALES(transNo,salesDate,custNo,empNo,status,stamp) VALUES ('S4SALE','2025-01-01','S4C','S4S','Active','TEST')")
    db.commit()


def cases(db, schema):
    for table,key,col in [('JOB','S4A','jobCode'),('DEPARTMENT','S4A','deptCode')]:
        assert_bad(db, f'DELETE FROM {table} WHERE {col}=?', (key,))
        assert_bad(db, f'UPDATE {table} SET status=? WHERE {col}=?', ('Inactive',key))
        # Parent may have inactive-only history; still cannot be physically removed.
        assert_bad(db, f'DELETE FROM {table} WHERE {col}=?', ('S4H',))
        assert_good(db, f'DELETE FROM {table} WHERE {col}=?', ('S4B',))
        assert_good(db, f'UPDATE {table} SET status=? WHERE {col}=?', ('Inactive','S4B'))
        assert_good(db, f'UPDATE {table} SET status=? WHERE {col}=?', ('Inactive','S4H'))
        # Inactive employee still has ACTIVE history: must block parent soft delete.
        assert_bad(db, f'UPDATE {table} SET status=? WHERE {col}=?', ('Inactive','S4I'))
    assert_bad(db, "DELETE FROM EMPLOYEE WHERE empNo='S4A'")  # history
    assert_bad(db, "DELETE FROM EMPLOYEE WHERE empNo='S4S'")  # sales only
    assert_good(db, "DELETE FROM EMPLOYEE WHERE empNo='S4N'")  # unreferenced

    # Employee soft-delete MUST preserve both history rows and sales.
    count=db.execute("SELECT COUNT(*) FROM JOBHISTORY WHERE empNo='S4A'").fetchone()[0]
    db.execute("UPDATE EMPLOYEE SET status='Inactive' WHERE empNo='S4A'")
    assert db.execute("SELECT COUNT(*) FROM JOBHISTORY WHERE empNo='S4A'").fetchone()[0] == count
    assert_good(db, "UPDATE EMPLOYEE SET status='Active' WHERE empNo='S4A'")
    assert_good(db, "UPDATE EMPLOYEE SET status='Active' WHERE empNo='S4Q'")
    assert_bad(db, "UPDATE EMPLOYEE SET status='Active' WHERE empNo='S4R'")
    # Once history becomes inactive, can deactivate the job/dept if no active employee references them.
    assert_bad(db, "INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,deptCode,status,stamp) VALUES ('S4N','S4C','2025-01-01',10,'S4C','Active','TEST')")
    assert_bad(db, "UPDATE JOBHISTORY SET jobCode='S4C' WHERE empNo='S4A'")
    assert_bad(db, "UPDATE JOBHISTORY SET status='Active' WHERE empNo='S4R'")
    assert_good(db, "INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,deptCode,status,stamp) VALUES ('S4N','S4B','2025-01-01',10,'S4B','Active','TEST')")
    assert_good(db, "UPDATE JOBHISTORY SET status='Inactive' WHERE empNo='S4A'")
    if schema == 'runner':
        # Main SQLite has explicit EMPLOYEE.jobCode/deptCode references.
        assert_bad(db, "UPDATE EMPLOYEE SET status='Active', jobCode='S4C' WHERE empNo='S4Q'")
        assert_bad(db, "UPDATE EMPLOYEE SET status='Active', jobCode='MISSING' WHERE empNo='S4Q'")
        assert_bad(db, "UPDATE EMPLOYEE SET status='Active', deptCode='S4C' WHERE empNo='S4Q'")
        assert_bad(db, "UPDATE EMPLOYEE SET jobCode='S4C' WHERE empNo='S4S'")
        assert_bad(db, "UPDATE EMPLOYEE SET deptCode='S4C' WHERE empNo='S4S'")
        assert_bad(db, "INSERT INTO EMPLOYEE(empNo,lastName,firstName,hireDate,jobCode,status,stamp) VALUES ('S4NEW','X','Y','2020-01-01','S4C','Active','TEST')")
    # Active history alone suffices even when employee is inactive.
    assert_bad(db, "UPDATE JOB SET status='Inactive' WHERE jobCode='S4A'")
    assert db.execute("SELECT COUNT(*) FROM SALES WHERE empNo='S4S'").fetchone()[0] == 1
    check_integrity(db)
    print(f'PASS {schema}: hard deletes, soft deletes, restores, active history, sales, orphan prevention')


def test_variant(name, core, up, down):
    db=sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    try:
        execute(ROOT/core,db)
        execute(ROOT/up,db)
        names={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%'")}
        expected=NAMES|({'trg_s3_hrri_employee_insert'} if name=='runner' else set())
        assert names==expected, (names,expected)
        setup_fixture(db,name)
        cases(db,name)
        check_integrity(db)
        before={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ('JOB','DEPARTMENT','EMPLOYEE','JOBHISTORY','SALES')}
        execute(ROOT/down,db)
        assert not db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%'").fetchall()
        assert before=={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in before}
        check_integrity(db)
        execute(ROOT/up,db)
        assert {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%'")}==expected
        cases(db,name)
        check_integrity(db)
        print('PASS',name,'up/down/up')
    finally:
        db.close()


def test_bundled_db():
    for name in ('HopeERP.db','HOPE_Model1.db'):
        source=ROOT/name
        if not source.exists():
            print('SKIP',name)
            continue
        db=sqlite3.connect(':memory:')
        original=sqlite3.connect(f'file:{source}?mode=ro',uri=True)
        try:
            original.backup(db)
            db.execute('PRAGMA foreign_keys=ON')
            before=[db.execute(f'SELECT count(*) FROM {t}').fetchone()[0] for t in ('EMPLOYEE','JOB','DEPARTMENT','JOBHISTORY','SALES')]
            execute(ROOT/'db/migrations/011_hr_referential_integrity.sql',db)
            assert [db.execute(f'SELECT count(*) FROM {t}').fetchone()[0] for t in ('EMPLOYEE','JOB','DEPARTMENT','JOBHISTORY','SALES')]==before
            check_integrity(db)
            print('PASS bundled SQLite clone:',name,'no data changed or orphaned')
        finally:
            db.close();original.close()


def run_sql_verification():
    db=sqlite3.connect(':memory:')
    try:
        db.execute('PRAGMA foreign_keys=ON')
        execute(ROOT/'db/migrations/001_hope_base_tables.sql',db)
        execute(ROOT/'db/migrations/011_hr_referential_integrity.sql',db)
        execute(ROOT/'db/verify/verify_hr_referential_integrity.sql',db)
        assert not db.in_transaction
        check_integrity(db)
        print('PASS SQL verification script (read-only checks and rolled-back soft delete)')
    finally:
        db.close()


def run_node_runner():
    if not shutil_which('node'):
        print('SKIP Node runner: node unavailable');return
    with tempfile.TemporaryDirectory() as tmp:
        location=Path(tmp)/'ephemeral.db'
        def call(*parts):
            p=subprocess.run(['node',str(ROOT/'scripts/migrate/index.js'),*parts, f'--db={location}', f'--dir={ROOT/"migrations"}'], cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
            assert p.returncode==0, p.stdout[-2600:]
            return p.stdout
        call('up')
        db=sqlite3.connect(location)
        try:
            db.execute('PRAGMA foreign_keys=ON')
            assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%'").fetchone()[0]==9
            check_integrity(db)
        finally: db.close()
        call('down');call('up')
        db=sqlite3.connect(location)
        try:
            assert db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_hrri_%'").fetchone()[0]==9
        finally:db.close()
        print('PASS Node.js migration runner up/down/up')


def shutil_which(name):
    import shutil
    return shutil.which(name)

if __name__=='__main__':
    test_variant('runner','migrations/001_init_core_schema.sql','migrations/010_hr_referential_integrity.sql','migrations/010_hr_referential_integrity.down.sql')
    test_variant('historical','db/migrations/001_hope_base_tables.sql','db/migrations/011_hr_referential_integrity.sql','db/migrations/011_hr_referential_integrity.down.sql')
    test_bundled_db()
    run_sql_verification()
    run_node_runner()
    print('ALL S3-DBA-04 SQLITE TESTS PASSED')
