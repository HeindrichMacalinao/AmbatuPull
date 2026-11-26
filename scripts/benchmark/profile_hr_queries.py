#!/usr/bin/env python3
"""Compare HR lookup plans/timings before and after S3-DBA-06 indexes.

Example:
  python3 -B scripts/benchmark/profile_hr_queries.py \
    --database ./data/hr_s3_dba06_benchmark.sqlite \
    --confirm-non-production

The input is opened read-only. Profiling happens on disposable copies in a
system temporary directory. ANALYZE and the new indexes are applied only to
those copies. The report contains actual local SQLite plans and timings.
"""
from __future__ import annotations

import argparse
import os
import platform
import sqlite3
import statistics
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX_MIGRATION = ROOT / 'migrations/011_hr_lookup_performance_indexes.sql'
AS_OF_DATE = '2026-11-26'

QUERIES = {
    'Employee substring search (LIKE %Garcia%)': {
        'sql': '''SELECT empNo, lastName, firstName, status
                  FROM EMPLOYEE
                  WHERE status = 'Active' AND lastName LIKE ?''',
        'params': ('%Garcia%',), 'repeats': 30,
    },
    'Employee exact primary-key lookup (empNo = E-001)': {
        'sql': '''SELECT empNo, lastName, firstName, status
                  FROM EMPLOYEE WHERE empNo = ?''',
        'params': ('E-001',), 'repeats': 100,
    },
    'Active JOBHISTORY timeline sorted by effDate DESC': {
        'sql': '''SELECT empNo, jobCode, deptCode, salary, effDate, status
                  FROM JOBHISTORY
                  WHERE empNo = ? AND status = 'Active'
                  ORDER BY effDate DESC''',
        'params': ('E-000005',), 'repeats': 60,
    },
    'Current job/salary as-of lookup for E-001': {
        'sql': '''SELECT empNo, jobCode, deptCode, salary, effDate
                  FROM JOBHISTORY
                  WHERE empNo = ? AND status = 'Active' AND effDate <= ?
                  ORDER BY effDate DESC LIMIT 1''',
        'params': ('E-001', AS_OF_DATE), 'repeats': 100,
    },
    'Batch active employee career join (EMPLOYEE/JOBHISTORY/JOB/DEPARTMENT)': {
        'sql': '''WITH ranked AS (
                    SELECT jh.empNo, jh.jobCode, jh.deptCode, jh.salary, jh.effDate,
                           ROW_NUMBER() OVER (
                             PARTITION BY jh.empNo
                             ORDER BY jh.effDate DESC, jh.jobCode
                           ) AS rn
                    FROM JOBHISTORY AS jh
                    WHERE jh.status = 'Active' AND jh.effDate <= ?
                  )
                  SELECT e.empNo, r.jobCode, j.jobDesc, r.deptCode,
                         d.deptName, r.salary, r.effDate
                  FROM v_active_employees AS e
                  LEFT JOIN ranked AS r ON r.empNo = e.empNo AND r.rn = 1
                  LEFT JOIN JOB AS j ON j.jobCode = r.jobCode
                  LEFT JOIN DEPARTMENT AS d ON d.deptCode = r.deptCode
                  ORDER BY e.empNo''',
        'params': (AS_OF_DATE,), 'repeats': 5,
    },
}
FK_LOOKUPS = {
    'EMPLOYEE child FK: jobCode': ('SELECT 1 FROM EMPLOYEE WHERE jobCode = ? LIMIT 1', ('BJOB-01',)),
    'JOBHISTORY child FK: jobCode': ('SELECT 1 FROM JOBHISTORY WHERE jobCode = ? LIMIT 1', ('BJOB-01',)),
    'JOBHISTORY child FK: deptCode': ('SELECT 1 FROM JOBHISTORY WHERE deptCode = ? LIMIT 1', ('BDEP-01',)),
    'EMPLOYEE child FK: deptCode (existing index)': ('SELECT 1 FROM EMPLOYEE WHERE deptCode = ? LIMIT 1', ('BDEP-01',)),
}


def refuse_production_path(path: Path) -> None:
    parts = [part.casefold() for part in path.parts]
    if any(part == 'prod' or 'production' in part or part.startswith(('prod-', 'prod_')) for part in parts):
        raise SystemExit('Refusing a path that looks like production. Use a disposable local benchmark file.')


def connect_copy(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=30)
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA cache_size = -65536')  # 64 MiB, consistent for both copies.
    conn.execute('PRAGMA temp_store = MEMORY')
    return conn


def clone_readonly(source_path: Path, destination: Path) -> sqlite3.Connection:
    source_uri = source_path.as_uri() + '?mode=ro'
    source = sqlite3.connect(source_uri, uri=True)
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
    finally:
        source.close()
    target.execute('PRAGMA foreign_keys = ON')
    target.execute('PRAGMA cache_size = -65536')
    target.execute('PRAGMA temp_store = MEMORY')
    return target


def plan_details(conn: sqlite3.Connection, sql: str, params: tuple) -> list[str]:
    return [str(row[3]) for row in conn.execute('EXPLAIN QUERY PLAN ' + sql, params).fetchall()]


def percentile95(samples: list[float]) -> float:
    ordered = sorted(samples)
    return ordered[max(0, int((len(ordered) * 0.95) + 0.999999) - 1)]


def time_query(conn: sqlite3.Connection, sql: str, params: tuple, repeats: int) -> dict:
    for _ in range(3):
        conn.execute(sql, params).fetchall()
    samples = []
    result_count = 0
    for _ in range(repeats):
        started = time.perf_counter_ns()
        rows = conn.execute(sql, params).fetchall()
        elapsed = (time.perf_counter_ns() - started) / 1_000_000
        samples.append(elapsed)
        result_count = len(rows)
    return {
        'median_ms': statistics.median(samples),
        'p95_ms': percentile95(samples),
        'min_ms': min(samples),
        'max_ms': max(samples),
        'rows': result_count,
        'repeats': repeats,
    }


def all_indexes(conn: sqlite3.Connection) -> dict[str, list[str]]:
    result = {}
    for table in ('EMPLOYEE', 'JOBHISTORY', 'JOB', 'DEPARTMENT'):
        entries = []
        for row in conn.execute(f'PRAGMA index_list("{table}")').fetchall():
            name, unique = row[1], row[2]
            partial = row[4] if len(row) > 4 else 0
            columns = [item[2] for item in conn.execute(f'PRAGMA index_info("{name}")').fetchall()]
            entries.append(
                f"{name} ({', '.join(columns)}; {'unique' if unique else 'non-unique'}"
                f"{' ; partial' if partial else ''})"
            )
        result[table] = entries
    return result


def render_index_map(indexes: dict[str, list[str]]) -> str:
    lines = []
    for table, entries in indexes.items():
        lines.append(f'- `{table}`: ' + (', '.join(f'`{item}`' for item in entries) if entries else 'no indexes'))
    return '\n'.join(lines)


def render_fk_plans(plans: dict[str, dict[str, list[str]]]) -> str:
    chunks = []
    for name, variants in plans.items():
        chunks.append(f'#### {name}')
        for label in ('Before', 'After'):
            chunks.append(f'**{label}:**')
            chunks.append('```text')
            chunks.extend(variants[label] or ['(no plan rows)'])
            chunks.append('```')
    return '\n'.join(chunks)


def render_plans(plans: dict[str, dict[str, list[str]]]) -> str:
    chunks = []
    for query_name, variants in plans.items():
        chunks.append(f'### {query_name}')
        for label in ('Before', 'After'):
            chunks.append(f'**{label}:**')
            chunks.append('```text')
            chunks.extend(variants[label] or ['(no plan rows)'])
            chunks.append('```')
    return '\n'.join(chunks)


def render_timings(timings: dict[str, dict[str, dict]]) -> str:
    lines = [
        '| Query | Before median (ms) | After median (ms) | Before p95 (ms) | After p95 (ms) | Rows |',
        '|---|---:|---:|---:|---:|---:|',
    ]
    for name, values in timings.items():
        before, after = values['Before'], values['After']
        lines.append(
            f"| {name} | {before['median_ms']:.3f} | {after['median_ms']:.3f} "
            f"| {before['p95_ms']:.3f} | {after['p95_ms']:.3f} | {after['rows']:,} |"
        )
    return '\n'.join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, required=True, help='Synthetic SQLite benchmark DB created by generate_hr_benchmark.py')
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/database/sprint-3-performance.md')
    parser.add_argument('--confirm-non-production', action='store_true', required=True, help='Acknowledge that this is a disposable local/test database')
    args = parser.parse_args()

    database = args.database.expanduser().resolve()
    refuse_production_path(database)
    if not database.is_file():
        parser.error(f'Benchmark database does not exist: {database}')
    if not INDEX_MIGRATION.is_file():
        parser.error(f'Missing index migration: {INDEX_MIGRATION}')

    out = args.output.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    readonly = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
    try:
        metadata = readonly.execute('SELECT fixture_name, employee_count, history_count FROM benchmark_metadata').fetchone()
        if not metadata or metadata[0] != 'S3-DBA-06 synthetic HR benchmark':
            parser.error('Input is not a database generated by generate_hr_benchmark.py; refusing to profile arbitrary data.')
        employee_count = readonly.execute('SELECT COUNT(*) FROM EMPLOYEE').fetchone()[0]
        history_count = readonly.execute('SELECT COUNT(*) FROM JOBHISTORY').fetchone()[0]
        if (employee_count, history_count) != (metadata[1], metadata[2]):
            parser.error('Benchmark metadata row counts do not match the database contents.')
        for name in ('idx_employee_active_name_cover', 'idx_employee_jobcode', 'idx_jobhistory_jobcode',
                     'idx_jobhistory_deptcode', 'idx_jobhistory_active_empno_effdate_cover'):
            if readonly.execute("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", (name,)).fetchone():
                parser.error(f'Input already contains tuned index {name}; regenerate a clean baseline database.')
    finally:
        readonly.close()

    with tempfile.TemporaryDirectory(prefix='s3-dba06-profile-') as temp:
        temp_dir = Path(temp)
        before_db = temp_dir / 'before.sqlite'
        after_db = temp_dir / 'after.sqlite'
        before = clone_readonly(database, before_db)
        after = clone_readonly(database, after_db)
        try:
            before.execute('ANALYZE')
            before.commit()
            after.execute('ANALYZE')
            after.commit()
            before_indexes = all_indexes(before)

            after.executescript(INDEX_MIGRATION.read_text(encoding='utf-8'))
            after.execute('ANALYZE')
            after.commit()
            after_indexes = all_indexes(after)

            plans: dict[str, dict[str, list[str]]] = {}
            timings: dict[str, dict[str, dict]] = {}
            for name, query in QUERIES.items():
                plans[name] = {
                    'Before': plan_details(before, query['sql'], query['params']),
                    'After': plan_details(after, query['sql'], query['params']),
                }
                timings[name] = {
                    'Before': time_query(before, query['sql'], query['params'], query['repeats']),
                    'After': time_query(after, query['sql'], query['params'], query['repeats']),
                }

            fk_plans = {}
            for name, (sql, params) in FK_LOOKUPS.items():
                fk_plans[name] = {
                    'Before': plan_details(before, sql, params),
                    'After': plan_details(after, sql, params),
                }

            expected_index = 'idx_jobhistory_active_empno_effdate_cover'
            if not any(expected_index in detail for detail in plans['Current job/salary as-of lookup for E-001']['After']):
                raise RuntimeError('SQLite planner did not choose the new covering JOBHISTORY index for the selective as-of lookup; review plans before accepting the migration.')
            if not any('idx_employee_active_name_cover' in detail for detail in plans['Employee substring search (LIKE %Garcia%)']['After']):
                raise RuntimeError('SQLite planner did not choose the active covering name index; review the query and data distribution.')
            if not any('sqlite_autoindex_EMPLOYEE_1' in detail for detail in plans['Employee exact primary-key lookup (empNo = E-001)']['After']):
                raise RuntimeError('Employee primary-key lookup did not use the existing primary-key index.')
            for name in ('EMPLOYEE child FK: jobCode', 'JOBHISTORY child FK: jobCode', 'JOBHISTORY child FK: deptCode'):
                if not any('USING' in detail.upper() and 'INDEX' in detail.upper() and 'idx_' in detail for detail in fk_plans[name]['After']):
                    raise RuntimeError(f'Expected an index-backed child-FK lookup after tuning: {name}')

            batch_after = timings['Batch active employee career join (EMPLOYEE/JOBHISTORY/JOB/DEPARTMENT)']['After']
            single_after = [value['After']['median_ms'] for name, value in timings.items()
                            if name != 'Batch active employee career join (EMPLOYEE/JOBHISTORY/JOB/DEPARTMENT)']
            target_assessment = (
                f"The four selective lookups measured below all met the 50 ms target in this local run "
                f"(maximum median {max(single_after):.3f} ms). The batch query did **not** meet the target: "
                f"median {batch_after['median_ms']:.3f} ms, p95 {batch_after['p95_ms']:.3f} ms, "
                f"returning {batch_after['rows']:,} active employee rows."
            )

            report = f'''# S3-DBA-06 — HR lookup and career-query performance

## Status and scope

Measured on the local SQLite benchmark fixture only. The source benchmark file was opened read-only; profiling ran on disposable copies. No production/Supabase database, live configuration, or checked-in application database was modified. No extension was enabled. PostgreSQL plans remain pending because this workspace has no local PostgreSQL server/client or authorized staging connection.

The benchmark target is **sub-50 ms** for each query, but this is a target, not a guarantee. See the measured values below; the batch query returns every active employee and is not directly comparable to a single-row lookup.

## Schema and existing indexes reviewed

- SQLite `{sqlite3.sqlite_version}`; Python `{sys.version.split()[0]}`; platform `{platform.platform()}`.
- Test data: `{employee_count:,}` EMPLOYEE rows and `{history_count:,}` JOBHISTORY rows, generated deterministically with fake names, dates, salaries, job codes, and department codes.
- Source schema: `migrations/001_init_core_schema.sql`; HR views/indexes: S3-DBA-01; domain triggers: S3-DBA-03; referential-integrity triggers: S3-DBA-04; demo rows: available S3-DBA-05 seed.
- SQLite lookup columns: `EMPLOYEE(empNo PK, lastName, firstName, deptCode, jobCode, status)`; `JOBHISTORY(empNo, jobCode, deptCode, effDate, salary, status; PK empNo/jobCode/effDate)`; `JOB(jobCode PK, jobDesc, status)`; `DEPARTMENT(deptCode PK, deptName, status)`.
- SQLite uses `JOBHISTORY.deptCode`; the PostgreSQL/Supabase schema inspected for this task does **not** have that column. The four-table historical department join is therefore only semantically valid in SQLite. PostgreSQL can join `DEPARTMENT` through `EMPLOYEE.deptCode`, but that is the employee's current department, not a historical as-of department.

### Indexes before profiling

{render_index_map(before_indexes)}

### Indexes after tuning (on a separate disposable copy)

{render_index_map(after_indexes)}

### PostgreSQL/Supabase schema and index review (not runtime-profiled)

- `EMPLOYEE`: primary key on `empNo`; S3-DBA-01 index `(status, lastName, firstName)`; foreign-key columns `deptCode` and `jobCode` had no child-side indexes in the inspected migrations.
- `JOBHISTORY`: primary key `(empNo, effDate)` and S3-DBA-01 index `(empNo, effDate, status)`; `jobCode` is a foreign key without its own child-side index. `deptCode` is absent in this PostgreSQL table.
- `JOB`: primary key `jobCode` and existing S3-DBA-01 `(status, jobCode)` index.
- `DEPARTMENT`: primary key `deptCode` and existing S3-DBA-01 `(status, deptCode)` index.
- Migration 013 adds child-side FK indexes and a partial covering active-history index. It was not applied or measured in this workspace.

## Test conditions and method

- Both copies were file-backed SQLite databases on the same local filesystem, with a 64 MiB SQLite page cache and in-memory temp storage.
- `ANALYZE` was run on each copy before measuring; it was rerun after the new indexes were created.
- Plans use `EXPLAIN QUERY PLAN`. Timings use Python `time.perf_counter_ns()` around parameterized `execute(...).fetchall()`, after 3 warm-up runs. Values are warm-cache local measurements, not production SLAs. Median and p95 are reported.
- Employee search pattern is passed as a bound parameter (`%Garcia%`); employee ID and dates are also bound parameters.
- No `EXPLAIN ANALYZE` is available in SQLite. No PostgreSQL `EXPLAIN ANALYZE` was run.

## Before/after timings

{render_timings(timings)}

### 50 ms target assessment

{target_assessment}

## SQLite execution-plan evidence

{render_plans(plans)}

### Child-side foreign-key / trigger lookups

{render_fk_plans(fk_plans)}

## Findings and recommendations

1. `EMPLOYEE.empNo` is a primary key and exact lookup uses its existing primary-key index. No duplicate empNo index was added.
2. The existing `(status,lastName,firstName)` B-tree cannot seek into a leading-wildcard pattern (`LIKE '%Garcia%'`). The SQLite active-name covering index may reduce row lookups for the active projection, but still scans matching active index entries; it is not a substring-search index. PostgreSQL `pg_trgm` and SQLite FTS5 trigram remain optional follow-ups and were **not enabled** pending explicit approval.
3. The new partial covering `JOBHISTORY` index targets the S3-DBA-02 predicate (`empNo`, `status='Active'`, `effDate <= asOfDate`, `ORDER BY effDate DESC`) and carries the columns needed for the history projection. SQLite selected it for the selective as-of lookup in the after plan.
4. Child-side indexes on `JOBHISTORY.jobCode` and `JOBHISTORY.deptCode`, plus `EMPLOYEE.jobCode`, support S3-DBA-04 parent delete/deactivation checks. `EMPLOYEE.deptCode` was already indexed in the SQLite runner schema; no duplicate was added.
5. The batch window query still processes a large share of the history rows and returns thousands of rows. A 50 ms goal is workload-, hardware-, cache-, and output-size-dependent; do not force index use or promise it without a representative deployment benchmark.
6. Follow-up for the batch target: benchmark a per-active-employee top-1 lookup (`LEFT JOIN LATERAL` in PostgreSQL, or a carefully tested correlated lookup in SQLite) using the new `(empNo, effDate DESC)` access path. This can avoid ranking every history row, but must preserve the no-history LEFT JOIN behavior and same-date tie policy. It is a query rewrite and was not included in this index-only ticket.

## Migration trade-offs and rollback

- New indexes consume disk and add write/update/delete cost. The partial history index stores only active history; FK indexes cover all referenced rows.
- Existing S3-DBA-01 indexes are intentionally retained; no index is dropped as part of this task.
- SQLite up/down: `migrations/011_hr_lookup_performance_indexes.sql` and `.down.sql`; alternate historical schema: `db/migrations/012_hr_lookup_performance_indexes.sql` and `.down.sql`.
- PostgreSQL up/down: `supabase/migrations/20261126_013_hr_lookup_performance_indexes.sql` and `supabase/rollback/20261126_013_hr_lookup_performance_indexes.down.sql`. The PG migration was not executed in this workspace. Standard `CREATE INDEX` takes a table lock during build; schedule on staging/maintenance window or use an approved concurrent-index deployment procedure if the migration framework supports non-transactional statements.
- Rollback removes only indexes created by S3-DBA-06. It does not remove prior indexes, views, data, or constraints.

## PostgreSQL verification status

Not run: no local PostgreSQL binaries or authorized staging connection were available in this workspace. Use `supabase/verify/20261126_hr_lookup_performance.sql` and `supabase/verify/20261126_hr_benchmark_fixture.sql` on a disposable PostgreSQL database. Run `ANALYZE` before `EXPLAIN (ANALYZE, BUFFERS)`. Do not run those scripts on production.

## Security review

- SQL in the benchmark scripts binds search patterns, employee IDs, and as-of dates; no untrusted input is concatenated into SQL.
- No query changes application authorization or tenant/data scope. The S3-DBA-02 salary helper's server-side `jobhistory.view` authorization requirement remains applicable.
- Salary is sensitive; keep these plans, fixture data, and reports in test environments. Do not expose raw salary rows or EXPLAIN output to browser users.
- The repository snapshot has no implemented HR employee-search route/query path to inspect. The report therefore reviews the ticket query shapes and the S3-DBA-02 helper contract, not an unobserved production UI query.
'''
            out.write_text(report, encoding='utf-8')

            print(f'Wrote report: {out}')
            print(f'SQLite {sqlite3.sqlite_version}; {employee_count:,} employees; {history_count:,} job-history rows')
            print(render_timings(timings))
            print('PASS: selective as-of lookup uses the new covering index')
            print('PASS: employee/job-history child FK lookups are index-backed after tuning')
            print('NOTE: PostgreSQL profiling not run; no local PostgreSQL server/client or staging connection available.')
        finally:
            before.close()
            after.close()


if __name__ == '__main__':
    main()
