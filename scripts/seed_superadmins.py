#!/usr/bin/env python3
"""S1-DBA-05 trusted, one-time Superadmin initialization.

Read *application-compatible precomputed password hashes* from a mode-0600
JSON file OUTSIDE the repository. Never accepts plaintext passwords, invents
email addresses, echoes secret contents, or auto-promotes existing accounts.

Run: python3 -B scripts/seed_superadmins.py --db /secure/local/hope-team.db \
     --accounts-file /secure/local/initial-admins.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import stat
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HANDLES = frozenset({
    'AlexGavarra', 'Chrollofuru', 'Tysennn', 'YthanOrogo', 'HeindrichMacalinao',
})
ALLOWED_KEYS = frozenset({'handle', 'firstName', 'lastName', 'email', 'passwordHash'})
MODULE_CODES = frozenset({'customer','product','human_resources','sales','reports'})
RIGHT_CODES = frozenset('''customer.add customer.edit customer.delete
product.add product.edit product.delete price.add price.edit price.delete
job.add job.edit job.delete dept.add dept.edit dept.delete emp.add emp.edit emp.delete
jobhistory.view jobhistory.add jobhistory.edit jobhistory.delete
sale.add sale.edit sale.delete saledetail.view saledetail.add saledetail.edit saledetail.delete
report.top_customers report.product_master report.top_products report.active_emp
report.all_emp report.emp_job_history report.top_sales'''.split())
assert len(RIGHT_CODES) == 36
EMAIL = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
BCRYPT = re.compile(r'^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$')
ARGON2ID = re.compile(
    r'^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$'
)


class SetupError(ValueError):
    """A deliberate non-secret provisioning validation error."""


def validate_hash(value: str) -> None:
    """Check supported encoded hash formats; actual verification belongs to app."""
    bcrypt = BCRYPT.fullmatch(value)
    if bcrypt:
        if int(bcrypt.group(1)) < 12:
            raise SetupError('bcrypt work factor must be at least 12')
        return
    argon2id = ARGON2ID.fullmatch(value)
    if argon2id:
        m, t, p = map(int, argon2id.groups())
        if m < 19456 or t < 2 or p < 1:
            raise SetupError('argon2id parameters below accepted setup minimum')
        return
    raise SetupError('only bcrypt >=12 or argon2id precomputed hashes are accepted')


def load_accounts(path: Path) -> list[dict[str, str]]:
    source = path.expanduser().resolve(strict=True)
    if source == ROOT or ROOT in source.parents:
        raise SetupError('secret account file must be outside the Git repository')
    if not source.is_file():
        raise SetupError('accounts file must be a regular file')
    if os.name == 'posix' and stat.S_IMODE(source.stat().st_mode) & 0o077:
        raise SetupError('accounts file must be owner-only (chmod 600)')
    try:
        raw = json.loads(source.read_text(encoding='utf-8'))
    except (ValueError, UnicodeError) as exc:
        raise SetupError('invalid accounts JSON') from exc
    if not isinstance(raw, list) or len(raw) != 5:
        raise SetupError('exactly five team members must be configured')
    handles: set[str] = set()
    emails: set[str] = set()
    names: set[tuple[str, str]] = set()
    hashes: set[str] = set()
    for account in raw:
        if not isinstance(account, dict) or set(account) != ALLOWED_KEYS:
            raise SetupError('account fields must be handle, firstName, lastName, email, passwordHash')
        if any(not isinstance(value, str) for value in account.values()):
            raise SetupError('all account fields must be strings')
        handle = account['handle']
        if handle not in HANDLES or handle in handles:
            raise SetupError('unknown or repeated team handle')
        handles.add(handle)
        name = (account['firstName'], account['lastName'])
        for value in name:
            if not value or value != value.strip() or len(value) > 50:
                raise SetupError('account names must be nonblank and within schema limits')
        if name in names:
            raise SetupError('account first/last name combinations must be unique')
        names.add(name)
        email = account['email']
        if email != email.strip() or len(email) > 100 or not EMAIL.fullmatch(email):
            raise SetupError('invalid email format')
        if email.lower() in emails:
            raise SetupError('duplicate account emails')
        emails.add(email.lower())
        password_hash = account['passwordHash']
        if len(password_hash) > 255:
            raise SetupError('password hash too long for app_user')
        validate_hash(password_hash)
        if password_hash in hashes:
            raise SetupError('repeated password hashes are not allowed')
        hashes.add(password_hash)
    if handles != HANDLES:
        raise SetupError('account list does not match the required five team handles')
    return raw


def provision(database: Path, accounts: list[dict[str, str]]) -> tuple[int, int]:
    db = database.expanduser().resolve(strict=True)
    if db == ROOT or ROOT in db.parents:
        raise SetupError('provisioned database must be outside the Git repository')
    if not db.is_file():
        raise SetupError('SQLite database is missing')
    conn = sqlite3.connect(f'file:{db.as_posix()}?mode=rw', uri=True, timeout=10)
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        if conn.execute('PRAGMA foreign_keys').fetchone() != (1,):
            raise SetupError('SQLite foreign-key enforcement is disabled')
        conn.execute('BEGIN IMMEDIATE')
        try:
            if conn.execute("SELECT COUNT(*) FROM role WHERE roleName='Superadmin'").fetchone()[0] != 1:
                raise SetupError('S1-DBA-03 user migration must run first')
            modules = {row[0] for row in conn.execute('SELECT moduleCode FROM module')}
            rights = {row[0] for row in conn.execute('SELECT rightCode FROM rights')}
            if modules != MODULE_CODES or rights != RIGHT_CODES:
                raise SetupError('S1-DBA-05 catalog seed must run before account provisioning')
            created = existing = 0
            for account in accounts:
                first, last = account['firstName'], account['lastName']
                email, digest = account['email'], account['passwordHash']
                collision = conn.execute('''SELECT userId, email, passwordHash, role, status, isBlocked
                    FROM app_user WHERE firstName=? AND lastName=?''', (first, last)).fetchall()
                row = conn.execute('''SELECT userId, firstName, lastName, passwordHash,
                    role, status, isBlocked FROM app_user WHERE email=? COLLATE NOCASE''', (email,)).fetchone()
                if row is not None:
                    uid, row_first, row_last, row_hash, role, status, blocked = row
                    if (row_first, row_last, row_hash, role, status, blocked) != \
                            (first, last, digest, 'Superadmin', 'Active', 0):
                        raise SetupError('conflicting existing account; refusing privilege or credential changes')
                    if any(other[0] != uid for other in collision):
                        raise SetupError('conflicting existing account identity')
                    existing += 1
                    continue
                if collision:
                    raise SetupError('team identity already linked to another email')
                conn.execute('''INSERT INTO app_user
                    (firstName, lastName, email, passwordHash, role, isBlocked, status, stamp)
                    VALUES (?, ?, ?, ?, 'Superadmin', 0, 'Active', 'SEED S1-DBA-05')''',
                    (first, last, email, digest))
                created += 1
            if conn.execute('PRAGMA foreign_key_check').fetchall():
                raise SetupError('foreign-key integrity failed')
            conn.commit()
            return created, existing
        except BaseException:
            conn.rollback()
            raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path,
                        help='private SQLite copy OUTSIDE the repository; never commit initialized accounts')
    parser.add_argument('--accounts-file', required=True, type=Path,
                        help='owner-only secret JSON OUTSIDE the repository; contains only precomputed hashes')
    args = parser.parse_args()
    try:
        accounts = load_accounts(args.accounts_file)
        created, existing = provision(args.db, accounts)
    except (SetupError, OSError, sqlite3.DatabaseError) as exc:
        # Do not dump JSON, SQL parameters, token hashes or other secret fields.
        if isinstance(exc, SetupError):
            parser.exit(1, f'ERROR: {exc}\n')
        parser.exit(1, 'ERROR: could not initialize accounts; inspect DB/file access safely\n')
    print(f'PASS: {created} Superadmin accounts created, {existing} already initialized; no secrets printed')


if __name__ == '__main__':
    main()
