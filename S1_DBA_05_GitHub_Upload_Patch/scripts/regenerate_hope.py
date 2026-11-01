#!/usr/bin/env python3
"""Rebuild integrated S1-DBA-01/02/03/04/05 SQLite database artifacts.

Run from the repository root: python scripts/regenerate_hope.py
Optional: python scripts/regenerate_hope.py --model1 path/to/Model1.db

Rebuilds both output DBs atomically, without modifying the source Model1.db.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'db/migrations/001_hope_base_tables.sql'
SEED = ROOT / 'db/seeds/002_hope_historical_data.sql'
USER_MIGRATION = ROOT / 'db/migrations/002_user_management_tables.sql'
RESET_MIGRATION = ROOT / 'db/migrations/003_password_reset_token.sql'
ACCESS_SEED = ROOT / 'db/seeds/003_initial_access_catalog.sql'
DEFAULT_MODEL1 = ROOT / 'reference/Model1.db'


def rebuild(target: Path, source_model: Path | None) -> None:
    # Regeneration is destructive. Refuse to erase a previously initialized
    # user's accounts/grants/tokens; users must archive the DB deliberately.
    if target.exists():
        with sqlite3.connect(f'file:{target.resolve().as_posix()}?mode=ro', uri=True) as previous:
            existing_tables = {row[0] for row in previous.execute(
                "SELECT name FROM sqlite_master WHERE type='table'")}
            for sensitive_table in ('app_user', 'user_permission', 'password_reset_token'):
                if sensitive_table in existing_tables and previous.execute(
                        f'SELECT COUNT(*) FROM "{sensitive_table}"').fetchone()[0]:
                    raise RuntimeError(
                        f'Refusing to overwrite {target.name}: {sensitive_table} has user data. '
                        'Regenerate only disposable artifacts; back up and remove files deliberately.'
                    )
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmpname = tempfile.mkstemp(prefix=f'.{target.stem}-', suffix='.db', dir=target.parent)
    os.close(fd)
    temporary = Path(tmpname)
    try:
        conn = sqlite3.connect(temporary)
        try:
            conn.execute('PRAGMA foreign_keys = ON')
            if source_model is not None:
                assert source_model.is_file(), f'Original source DB not found: {source_model}'
                source = sqlite3.connect(f'file:{source_model.resolve().as_posix()}?mode=ro', uri=True)
                try:
                    source.backup(conn)
                finally:
                    source.close()
                conn.execute('PRAGMA foreign_keys = ON')
            conn.executescript(MIGRATION.read_text(encoding='utf-8'))
            conn.executescript(SEED.read_text(encoding='utf-8'))
            # S1-DBA-03 runs AFTER S1-DBA-02 so EMPLOYEE exists.
            conn.executescript(USER_MIGRATION.read_text(encoding='utf-8'))
            # S1-DBA-04 runs AFTER S1-DBA-03 so app_user exists.
            conn.executescript(RESET_MIGRATION.read_text(encoding='utf-8'))
            # S1-DBA-05 loads the exact catalog AFTER module/rights exist.
            # Actual Superadmin identities and hashes require a private operator step.
            conn.executescript(ACCESS_SEED.read_text(encoding='utf-8'))
            assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
            assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            conn.commit()
        finally:
            conn.close()
        os.replace(temporary, target)
        print(f'BUILT: {target.name} ({target.stat().st_size:,} bytes)')
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model1', type=Path, default=DEFAULT_MODEL1,
                        help='original simulation Model1.db to preserve in HOPE_Model1.db')
    args = parser.parse_args()
    rebuild(ROOT / 'HopeERP.db', None)
    rebuild(ROOT / 'HOPE_Model1.db', args.model1)


if __name__ == '__main__':
    main()
