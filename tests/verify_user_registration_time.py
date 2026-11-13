#!/usr/bin/env python3
"""Verify the user-registration timestamp migration preserves historical unknowns."""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'db/migrations/005_app_user_created_at.sql'


def main() -> None:
    with sqlite3.connect(':memory:') as conn:
        conn.execute('CREATE TABLE app_user (userId INTEGER PRIMARY KEY, email TEXT NOT NULL)')
        conn.execute('INSERT INTO app_user (userId, email) VALUES (1, ?)', ('legacy@example.com',))
        conn.executescript(MIGRATION.read_text(encoding='utf-8'))

        legacy_created_at = conn.execute(
            'SELECT createdAt FROM app_user WHERE userId = 1'
        ).fetchone()[0]
        assert legacy_created_at is None, 'Existing users must not receive a false registration time'

        registered_at = '2026-11-12T07:00:00.000Z'
        conn.execute(
            'INSERT INTO app_user (userId, email, createdAt) VALUES (2, ?, ?)',
            ('new@example.com', registered_at),
        )
        stored_created_at = conn.execute(
            'SELECT createdAt FROM app_user WHERE userId = 2'
        ).fetchone()[0]
        assert stored_created_at == registered_at, 'New registration time must be persisted'

    print('PASS: existing registration dates remain unknown; new registration dates persist')


if __name__ == '__main__':
    main()
