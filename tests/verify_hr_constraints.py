#!/usr/bin/env python3
"""S3-DBA-03: isolated SQLite HR constraints tests, with no changes to project DBs.

Run: python3 -B tests/verify_hr_constraints.py
"""
from __future__ import annotations

import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UP = ROOT / 'migrations/009_employee_jobhistory_domain_constraints.sql'
DOWN = ROOT / 'migrations/009_employee_jobhistory_domain_constraints.down.sql'
ASSET_UP = ROOT / 'db/migrations/010_employee_jobhistory_domain_constraints.sql'
TRIGGERS = {
    'trg_s3_employee_hr_domain_insert',
    'trg_s3_employee_hr_domain_update',
    'trg_s3_jobhistory_hr_domain_insert',
    'trg_s3_jobhistory_hr_domain_update',
}


def execfile(conn: sqlite3.Connection, path: Path) -> None:
    conn.executescript(path.read_text(encoding='utf8'))


def integrity(conn: sqlite3.Connection) -> None:
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
    assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'


def assert_bad(conn: sqlite3.Connection, sql: str, params: tuple, label: str) -> None:
    conn.execute('SAVEPOINT bad_case')
    try:
        try:
            conn.execute(sql, params)
        except sqlite3.IntegrityError:
            print('PASS rejected:', label)
        else:
            raise AssertionError(f'UNEXPECTEDLY ACCEPTED: {label}')
    finally:
        conn.execute('ROLLBACK TO SAVEPOINT bad_case')
        conn.execute('RELEASE SAVEPOINT bad_case')


def assert_good(conn: sqlite3.Connection, sql: str, params: tuple, label: str) -> None:
    conn.execute('SAVEPOINT good_case')
    try:
        conn.execute(sql, params)
        print('PASS accepted:', label)
    finally:
        conn.execute('ROLLBACK TO SAVEPOINT good_case')
        conn.execute('RELEASE SAVEPOINT good_case')


def fixture(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO JOB(jobCode,jobDesc,status,stamp) VALUES ('HR3JOB','HR test job','Active','TEST')")
    conn.execute("INSERT INTO EMPLOYEE(empNo,lastName,firstName,gender,birthDate,hireDate,sepDate,status,stamp) "
                 "VALUES ('HR3EMP','Test','HR','F','1990-01-01','2020-01-01',NULL,'Active','TEST')")
    conn.execute("INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,status,stamp) "
                 "VALUES ('HR3EMP','HR3JOB','2020-01-01',100,'Active','TEST')")


def test_domains(conn: sqlite3.Connection) -> None:
    employee_insert = ('INSERT INTO EMPLOYEE(empNo,lastName,firstName,gender,birthDate,hireDate,sepDate,status,stamp) '
                       "VALUES ('HR3NEW','Test','HR',?,?,?,?,'Active','TEST')")
    for g in ('X', 'male', '', 'U'):
        assert_bad(conn, employee_insert, (g, '1990-01-01', '2020-01-01', None), 'INSERT invalid gender ' + repr(g))
    assert_bad(conn, 'UPDATE EMPLOYEE SET gender=? WHERE empNo=?', ('X', 'HR3EMP'), 'UPDATE invalid gender')
    for g in ('M','F','O',None):
        assert_good(conn, employee_insert, (g, '1990-01-01', '2020-01-01', None), 'INSERT allowed gender ' + repr(g))
    assert_good(conn, 'UPDATE EMPLOYEE SET gender=? WHERE empNo=?', ('O','HR3EMP'), 'UPDATE nonbinary O')

    for sep,should_pass in [('2019-12-31',False), ('2020-01-01',True),('2020-01-02',True),(None,True)]:
        if should_pass:
            assert_good(conn, employee_insert, ('M','1990-01-01','2020-01-01',sep), 'INSERT sepDate '+repr(sep))
            assert_good(conn,'UPDATE EMPLOYEE SET sepDate=? WHERE empNo=?',(sep,'HR3EMP'),'UPDATE sepDate '+repr(sep))
        else:
            assert_bad(conn, employee_insert, ('M','1990-01-01','2020-01-01',sep), 'INSERT separation before hire')
            assert_bad(conn,'UPDATE EMPLOYEE SET sepDate=? WHERE empNo=?',(sep,'HR3EMP'),'UPDATE separation before hire')
    for birth in ['2020-01-01','2020-01-02']:
        assert_bad(conn, employee_insert, ('M',birth,'2020-01-01',None),'INSERT birth not before hire')
        assert_bad(conn,'UPDATE EMPLOYEE SET birthDate=? WHERE empNo=?',(birth,'HR3EMP'),'UPDATE birth not before hire')
    assert_good(conn, employee_insert,('M',None,'2020-01-01',None),'INSERT NULL birthDate')
    assert_good(conn,'UPDATE EMPLOYEE SET birthDate=? WHERE empNo=?',(None,'HR3EMP'),'UPDATE NULL birthDate')
    for bad_date in ['2020-2-1','2020-02-30','2026-02-29','2020/01/01','nonsense','2020-00-01']:
        assert_bad(conn,employee_insert,('M','1990-01-01',bad_date,None),'INSERT malformed hireDate '+bad_date)
        assert_bad(conn,'UPDATE EMPLOYEE SET hireDate=? WHERE empNo=?',(bad_date,'HR3EMP'),'UPDATE malformed hireDate '+bad_date)
    assert_bad(conn,employee_insert,('M','1990-02-30','2020-01-01',None),'INSERT impossible birthDate')
    assert_bad(conn,'UPDATE EMPLOYEE SET sepDate=? WHERE empNo=?',('2026-02-30','HR3EMP'),'UPDATE impossible sepDate')
    assert_good(conn,employee_insert,('M','1992-02-29','2020-01-01',None),'INSERT valid leap birthDate')

    hist_insert = ("INSERT INTO JOBHISTORY(empNo,jobCode,effDate,salary,status,stamp) "
                   "VALUES ('HR3EMP','HR3JOB',?,?,'Active','TEST')")
    for price in (-1, -0.01):
        assert_bad(conn,hist_insert,('2021-01-01',price),'INSERT negative salary '+str(price))
        assert_bad(conn,'UPDATE JOBHISTORY SET salary=? WHERE empNo=? AND jobCode=?',
                   (price,'HR3EMP','HR3JOB'),'UPDATE negative salary '+str(price))
    for price in (0, 1, None):
        assert_good(conn,hist_insert,('2021-01-01',price),'INSERT salary '+repr(price))
        assert_good(conn,'UPDATE JOBHISTORY SET salary=? WHERE empNo=? AND jobCode=?',
                    (price,'HR3EMP','HR3JOB'),'UPDATE salary '+repr(price))
    assert_bad(conn,hist_insert,(None,20),'INSERT NULL effDate')
    assert_bad(conn,'UPDATE JOBHISTORY SET effDate=? WHERE empNo=?',(None,'HR3EMP'),'UPDATE NULL effDate')
    assert_bad(conn,hist_insert,('2020-02-30',20),'INSERT impossible effDate')
    assert_bad(conn,'UPDATE JOBHISTORY SET effDate=? WHERE empNo=?',('2020-02-30','HR3EMP'),'UPDATE impossible effDate')
    assert_good(conn,hist_insert,('2024-02-29',20),'INSERT leap effDate')


def verify(name: str, core: str, up: str) -> None:
    conn=sqlite3.connect(':memory:')
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        execfile(conn,ROOT/core)
        execfile(conn,ROOT/('migrations/008_active_hr_views_indexes.sql' if name == 'runner' else 'db/migrations/009_active_hr_views_indexes.sql'))
        # The original schemas have NO existing HR trigger with these S3-prefixed names.
        assert not TRIGGERS.intersection(x[0] for x in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'"))
        execfile(conn,ROOT/up)
        assert TRIGGERS == {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_%hr_domain_%'")}
        fixture(conn)
        test_domains(conn)
        integrity(conn)
        assert conn.execute("SELECT name FROM sqlite_master WHERE name='v_active_jobhistory'").fetchone()
        before={t:conn.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ('EMPLOYEE','JOBHISTORY')}
        execfile(conn,DOWN)
        assert not TRIGGERS.intersection(x[0] for x in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'"))
        assert before == {t:conn.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in before}
        execfile(conn,ROOT/up)
        assert TRIGGERS == {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_%hr_domain_%'")}
        integrity(conn)
        print('PASS',name,'up/down/up; existing indexes, views, data and FKs retained')
    finally:
        conn.close()


def verify_real_bundled_assets() -> None:
    for file in ('HopeERP.db','HOPE_Model1.db'):
        actual=ROOT/file
        if not actual.is_file():
            print('SKIP absent DB artifact:',file)
            continue
        read=sqlite3.connect(f'file:{actual}?mode=ro',uri=True)
        clone=sqlite3.connect(':memory:')
        try:
            read.backup(clone)
            n1=clone.execute('SELECT count(*) FROM EMPLOYEE').fetchone()[0]
            n2=clone.execute('SELECT count(*) FROM JOBHISTORY').fetchone()[0]
            assert (n1,n2)==(32,54),f'unexpected fixture counts {file}: {(n1,n2)}'
            execfile(clone,ROOT/'db/migrations/010_employee_jobhistory_domain_constraints.sql')
            assert clone.execute('SELECT count(*) FROM EMPLOYEE').fetchone()[0]==n1
            assert clone.execute('SELECT count(*) FROM JOBHISTORY').fetchone()[0]==n2
            integrity(clone)
            print('PASS historical preflight and migration on disposable copy:',file)
        finally:
            read.close();clone.close()


def verify_preflight_rejects_bad_legacy() -> None:
    # Deliberately insert a legacy invalid row before installing the triggers.
    # Check that the migration refuses to install rather than mutating data.
    conn = sqlite3.connect(':memory:')
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        execfile(conn, ROOT / 'db/migrations/001_hope_base_tables.sql')
        conn.execute("INSERT INTO EMPLOYEE(empNo,gender,birthDate,hireDate,sepDate,status,stamp) "
                     "VALUES ('BAD01','X','2000-01-01','2020-01-01','2019-01-01','Active','TEST')")
        try:
            execfile(conn, ASSET_UP)
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError('Invalid legacy row incorrectly accepted during migration')
        assert conn.execute("SELECT gender FROM EMPLOYEE WHERE empNo='BAD01'").fetchone()[0] == 'X'
        assert conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE name LIKE 'trg_s3_%'").fetchone()[0] == 0
        print('PASS historical preflight: invalid legacy row blocks installation, remains unchanged')
    finally:
        conn.close()


def runner_cycle() -> None:
    if not shutil.which('node'):
        print('SKIP Node runner: node unavailable');return
    with tempfile.TemporaryDirectory(prefix='s3-dba-03-') as d:
        tmp=Path(d); migrations=tmp/'migrations';migrations.mkdir()
        shutil.copy2(UP,migrations/UP.name);shutil.copy2(DOWN,migrations/DOWN.name)
        db=tmp/'runner.db'
        conn=sqlite3.connect(db)
        try:
            execfile(conn,ROOT/'migrations/001_init_core_schema.sql')
        finally:
            conn.close()
        for cmd in ('up','down','up','status'):
            res=subprocess.run(['node',str(ROOT/'scripts/migrate/index.js'),cmd,
                                f'--db={db}',f'--dir={migrations}'],capture_output=True,text=True,cwd=ROOT,timeout=25)
            if res.returncode:raise AssertionError(f'Node runner {cmd} failed:\n{res.stdout}\n{res.stderr}')
            print('PASS Node runner:',cmd)
        conn=sqlite3.connect(db)
        try:
            assert TRIGGERS == {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_s3_%hr_domain_%'")}
            integrity(conn)
        finally:conn.close()


def main() -> None:
    print('SQLite version:',sqlite3.sqlite_version,'— all writes only to disposable DBs')
    verify('runner','migrations/001_init_core_schema.sql','migrations/009_employee_jobhistory_domain_constraints.sql')
    verify('historical','db/migrations/001_hope_base_tables.sql','db/migrations/010_employee_jobhistory_domain_constraints.sql')
    verify_real_bundled_assets()
    verify_preflight_rejects_bad_legacy()
    runner_cycle()
    print('ALL S3-DBA-03 SQLITE TESTS PASSED')

if __name__=='__main__': main()
